import json
from datetime import datetime
from typing import Dict

from fastapi import Body
from pydantic import BaseModel, field_validator
from typing_extensions import Optional

from schemas.db.TaskStatus import TaskStatus
from schemas.json.Action import ActionResponse
from schemas.json.Dataset import DatasetResponse


class TaskCreatedResponse(BaseModel):
    id: int
    status: TaskStatus
    time_start: datetime


class TaskResponse(BaseModel):
    id: int
    id_user: int
    id_process: int | None
    status: TaskStatus

    name: str
    output_path: str | None
    datasets: list[DatasetResponse] | None
    time_start: datetime | None
    time_end: datetime | None
    inputs: Optional[dict] = None

    action: ActionResponse | None

    class Config:
        from_attributes = True


class TaskInputs(BaseModel):
     # Flexible body received through requests
    parameters: Optional[Dict[str, str]] = Body(default=None, description='Associative array of all of the parameters needed to configure and launch the task.')
    # ID of files/datasets that should be sent to the Task script
    datasets: Optional[Dict[str, int | list[int]]] = Body(default=None, description='Associative array of datasets IDs required by the task. Dataset must in the database. The dataset\'s filepath will be acquired internally. Usage: {"parameter": numerical id of a /dataset}')

     # Basic guards: keys must be str; parameter values must be str
    @field_validator("parameters")
    @classmethod
    def _validate_parameters(cls, v):
        if v is None:
            return v
        for k, val in v.items():
            if not isinstance(k, str) or not isinstance(val, str):
                raise ValueError("parameters must be Dict[str, str]")
        return v

    # Coerce datasets values to lists
    @field_validator("datasets")
    @classmethod
    def _validate_datasets(cls, v):
        if v is None:
            return v
        norm: Dict[str, list[int]] = {}
        for k, val in v.items():
            if not isinstance(k, str):
                raise ValueError("datasets keys must be str")
            if isinstance(val, int):
                norm[k] = [val]
            elif isinstance(val, list) and all(isinstance(x, int) for x in val):
                norm[k] = val
            else:
                raise ValueError("datasets values must be int or list[int]")
        return norm


class TaskParameters(TaskInputs):
    name: Optional[str] = None


class TaskCreate(BaseModel):
    name: str
    id_user: int
    id_action: Optional[int] = None
    id_process: Optional[int] = None
    output_path: Optional[str] = None
    inputs: Optional[TaskInputs | TaskParameters] = None


class TaskPatch(BaseModel):
    id_process: int | None = None
    output_path: str | None = None
    status: TaskStatus | None = None
    time_end: datetime | None = None


def serialize_task_inputs(task_parameters: TaskInputs | TaskParameters) -> str:
    # Build a clean envelope; omit None fields to keep it tight
    envelope: Dict[str, any] = {
        "parameters": task_parameters.parameters or {},
        # ensure datasets are lists in the stored form
        "datasets": task_parameters.datasets or {},  # thanks to validator, values are List[int]
    }

    # drop keys that are None (but keep empty dicts)
    envelope = {k: v for k, v in envelope.items() if v is not None}

    # Compact, deterministic JSON
    return json.dumps(
        envelope,
        ensure_ascii=False,  # keep UTF-8
        separators=(",", ":"),  # compact
        sort_keys=True,
        allow_nan=False,  # disallow NaN/Infinity
    )

def deserialize_task_inputs(task_parameters_payload: str) -> TaskInputs:
    task_parameters = json.loads(task_parameters_payload or "{}")

    # Convert stored canonical lists back to the original union shape:
    datasets = task_parameters.get("datasets")

    if isinstance(datasets, dict):
        restored = {}

        for k, v in datasets.items():
            if isinstance(v, list):
                restored[k] = v[0] if len(v) == 1 else v
            else:
                # for very old rows where value might be int
                restored[k] = v

        task_parameters["datasets"] = restored

    return TaskParameters(**task_parameters)
