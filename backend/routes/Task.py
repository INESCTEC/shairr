import logging
import os.path
from datetime import datetime
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, status, BackgroundTasks
from fastapi.params import Query
from fastapi.responses import PlainTextResponse

from core.Auth import OidcWorkflow
from core.Config import config
from core.Files import Files
from schemas.dao.Action import ActionRepository
from schemas.dao.Task import TaskRepository
from schemas.db.Task import Task
from schemas.db.TaskStatus import TaskStatus
from schemas.json.Count import CountResponse
from schemas.json.Stats import StatsResponse
from schemas.json.Task import TaskParameters, TaskCreatedResponse, TaskCreate, TaskResponse, TaskPatch, \
    TaskInputs
from schemas.json.User import UserData
from services.NextflowLogReader import NextflowLogReader
from services.NextflowService import NextflowService
from utils.hashing import compute_task_hash

CACHE_BASE = "data/cache"
from services.StatsService import StatsService

router = APIRouter()

logger = logging.getLogger(__name__)


@router.get(
    "/task",
    description="List every task launched in the current user."
)
def get_tasks(
        user: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
        task_status: TaskStatus = None
) -> list[TaskResponse]:
    orm: list[Task] = TaskRepository.get_all_by_user(user.id, task_status)
    return [TaskResponse.model_validate(o) for o in orm]


@router.get(
    "/task/count",
    description="Return a count of tasks"
)
def count_tasks(
        user: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
        task_status: TaskStatus = None
) -> CountResponse:
    return CountResponse(count=TaskRepository.count(user.id, task_status))


@router.get(
    "/task/{id_task}",
    description="Get specific task. Will only return if tasks launched by the current user."
)
def get_task(
        user: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
        id_task: int,
) -> TaskResponse:
    task: Task = TaskRepository.get_by_user(user.id, id_task)

    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return TaskResponse.model_validate(task)


@router.get(
    "/task/{id_task}/log",
    description="Return log file output associated with this task.",
    response_class=PlainTextResponse
)
def get_task_log(
    user: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_task: int,
    include_stderr=False
) -> str:
    task: Task = TaskRepository.get_by_user(user.id, id_task)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    if not task.output_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task did not output any contents"
        )

    work_dir = Path(task.output_path) / "work"

    files = NextflowLogReader.collect(work_dir, include_stderr)

    if not files:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No log files found for this task"
        )

    return NextflowLogReader.render(files, base_dir=work_dir)


@router.post(
    "/task/{action_codename}",
    description="""
Start a parallel **Nextflow** task. This endpoint takes parameters and passes them on to Nextflow as-is, in addition, it
resolves dataset IDs to absolute filesystem paths, then launches Nextflow **in the background**
via `subprocess`.

### Parameters vs Datasets
- **parameters** *(Dict[str, str])* — forwarded to Nextflow **as-is** as strings. Keys are flexible;
  whatever you send is available in Nextflow as `params.<key>`.
  Examples:
  - `"length": "9"` -> Gets passed as `--length=9` -> Can be acquired inside Nextflow as `params.length`
  - `"alleles": "HLA-A*01:01, HLA-A*02:01"` -> Gets passed as `--alleles=HLA-A*01:01, HLA-A*02:01` -> Can be acquired inside Nextflow as `params.alleles`
- **datasets** *(Dict[str, int | list[int]])* — IDs of datasets registered in the API (also accepts a single ID).
  The server validates the IDs and replaces them with **absolute filesystem paths** before
  passing them to Nextflow. Single values become one path; arrays become a comma-separated list of strings.
  This can be parsed in the Nextflow script using `params.<key>.split(',')`

### How values are sent to Nextflow

Consider the values:

```json
{
  "parameters": { "length": "9", "biological": false },
  "datasets": { "repertoire": 11}
}
```

```shell
nextflow run <pipeline.nf> \
  --length=9 \
  --biological=false \
  --antigen=/abs/path/antigen.fasta \
  --reads=/abs/path/R1.fastq.gz,/abs/path/R2.fastq.gz
```

The HTTP call returns **201 Created** immediately with metadata for the task.
Use the related /log endpoints to monitor the run.

#### Full example request
```json
{
  "id_pipeline_step": 4,
  "parameters": {
    "alleles": "HLA-A*01:01, HLA-A*02:01, HLA-A*02:12, HLA-A*01:01, HLA-A*02:01, HLA-A*01:01, HLA-A*02:01",
    "length": "9"
  },
  "datasets": { "antigen": 11 }
}
```

Notes:
- Parameters are passed as strings.
- Dataset IDs are resolved to absolute paths and passed as strings.
- Launcher uses subprocess.
- Concurrency/availability limits may return HTTP_429_TOO_MANY_REQUESTS.
""",
    status_code=status.HTTP_200_OK
)
def create_task(
        user: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
        background_tasks: BackgroundTasks,
        task_parameters: TaskParameters,
        action_codename: str = Path(description="Unique codename that identifies which action from a tool to run.")
) -> TaskCreatedResponse:
    if TaskRepository.count(user.id, TaskStatus.RUNNING) > config.max_tasks_session:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Maximum number of {config.max_tasks_session} concurrent running tasks has been reached"
        )

    action = ActionRepository.get_by_codename(action_codename)

    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action codename does not exist."
        )

    script_path = Files.format_action_scripts_path(action.script)

    if not action.script or not os.path.isfile(script_path):
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Requested action does not have an execution script defined."
        )

    if not action.tool.installed:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"Tool '{action.tool.name} (id: {action.tool.id})' needs to be installed before running this command."
        )


    task_name = task_parameters.name \
        if task_parameters.name \
        else f"{action.name} {int(datetime.utcnow().timestamp())}"

    task = Task(
        name=task_name,
        id_user=user.id,
        id_action=action.id,
        inputs=task_parameters.model_dump(include=TaskInputs.model_fields.keys())
    )

    task = TaskRepository.create(task)

    task_patch = TaskPatch(output_path=os.path.join(f"data/tasks/{task.id}"))
    TaskRepository.update_by_user(user.id, task.id, task_patch)

    background_tasks.add_task(NextflowService.run_task, user, task, task_parameters)

    #create_nextflow_task.delay(user.id_keycloak, task.id)

    return task

@router.post(
    "/task/stats/r-immunarch-compute-stats",
    status_code=status.HTTP_200_OK
)
def create_task_stats(
        user: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
        background_tasks: BackgroundTasks,
        task_parameters: TaskParameters,
) -> StatsResponse :
    if not parse_stats_keyword(task_parameters.parameters, "ignore_cache"):
        cache_entry = StatsService.get_result_from_cache(user.id, task_parameters)
        if (cache_entry):
            response: StatsResponse = StatsResponse(
                served_from_cache=True,
                result_datasets=cache_entry,
                task_response=None
            )
            return response

    if TaskRepository.count(user.id, TaskStatus.RUNNING) > config.max_tasks_session:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Maximum number of {config.max_tasks_session} concurrent running tasks has been reached"
        )

    action = ActionRepository.get_by_codename("r-immunarch-compute-stats")

    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action codename does not exist."
        )

    script_path = Files.format_action_scripts_path(action.script)

    if not action.script or not os.path.isfile(script_path):
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Requested action does not have an execution script defined."
        )

    if not action.tool.installed:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"Tool '{action.tool.name} (id: {action.tool.id})' needs to be installed before running this command."
        )

    task_name = task_parameters.name \
        if task_parameters.name \
        else f"{action.name} {int(datetime.utcnow().timestamp())}"

    task = Task(
        name=task_name,
        id_user=user.id,
        id_action=action.id,
        inputs=task_parameters.model_dump(include=TaskInputs.model_fields.keys())
    )

    task = TaskRepository.create(task)

    task_patch = TaskPatch(output_path=os.path.join(f"data/tasks/{task.id}"))
    TaskRepository.update_by_user(user.id, task.id, task_patch)

    background_tasks.add_task(NextflowService.run_task, user, task, task_parameters)

    #create_nextflow_task.delay(user.id_keycloak, task.id)

    task_create_response: TaskCreatedResponse = TaskCreatedResponse(
        id = task.id,
        status = task.status,
        time_start = task.time_start
    )

    response : StatsResponse = StatsResponse(
    served_from_cache = False,
    result_datasets = None,
    task_response = task_create_response
    )
    return response

@staticmethod
def parse_stats_keyword(parameters, key: str) -> bool:
    if hasattr(parameters, "dict"):
        param_dict = parameters.dict()
    elif hasattr(parameters, "__dict__"):
        param_dict = vars(parameters)
    else:
        param_dict = parameters

    value = param_dict.get(key, 'false')

    return str(value).lower() == 'true'


@router.delete(
    "/task/{id_task}",
    description="Preemptively terminates a running task."
)
def delete_task(
        user: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
        id_task: int
) -> TaskResponse:
    task = TaskRepository.get_by_user(user.id, id_task)

    if not task or task.status != TaskStatus.RUNNING:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or not currently running."
        )

    try:
        NextflowService.kill_task(task)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Process not found or already finished. Details: {e}"
        )
    finally:
        task = TaskRepository.update_by_user(user.id, task.id, TaskPatch(status=TaskStatus.KILLED))
        return task
