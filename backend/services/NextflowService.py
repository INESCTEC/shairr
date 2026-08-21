import logging
import shutil,os
import signal
import subprocess
import time
from datetime import datetime

from typing_extensions import AnyStr, Tuple

from core.Config import config
from core.Files import Files
from exceptions.NfSubprocessException import NfSubprocessException
from schemas.dao.Dataset import DatasetRepository
from schemas.dao.StatsCache import StatsCacheRepository
from schemas.dao.Task import TaskRepository
from schemas.dao.Tool import ToolRepository
from schemas.db import Tool, Dataset
from schemas.db.StatsType import StatsType
from schemas.db.Task import Task
from schemas.db.TaskStatus import TaskStatus
from schemas.json.Dataset import DatasetCreate
from schemas.json.Task import TaskPatch, TaskParameters
from schemas.json.User import UserData
from utils.hashing import compute_task_hash

logger = logging.getLogger(__name__)

from shutil import which

if not which("nextflow"):
    logger.error("Attention: Nextflow is not installed. Won't be able to run processing pipelines")

# Patch shutil.which to fake Nextflow installation
_original_which = which

which = lambda cmd: "/usr/bin/nextflow" if not which("nextflow") else _original_which(cmd)

import nextflow.command
import nextflow.models

# Restore original behavior - just in case
which = _original_which

class NextflowService:
    """
    Standard output files produced by Nextflow on processing job
    """
    _std_work_files = ['.command.log', '.command.run', '.command.sh',
                       '.command.err', '.command.begin', '.command.out', '.exitcode']

    @staticmethod
    def run_task(user: UserData, task: Task, task_parameters: TaskParameters = None) -> None:
        try:
            action = task.action
            logger.debug(f"Starting task id: {task.id} for action {action.codename} (id: {action.id})")

            output_path = Files.format_action_output_path(str(task.id))
            logger.debug(f"Task output will be placed in {output_path}")

            task_parameters_dump = task_parameters.model_dump() if task_parameters and task_parameters.parameters else None
            logger.debug(f"Task received inputs: {task_parameters}")

            # Raw inputs (IDs/strings) from request – used for hashing
            raw_params = (task_parameters.parameters if task_parameters and task_parameters.parameters else {})
            raw_datasets = (task_parameters.datasets if task_parameters and task_parameters.datasets else {})

            # Build the CLI body (with resolved dataset paths)
            body_parameters = task_parameters_dump['parameters'] if task_parameters_dump and 'parameters' in task_parameters_dump else {}
            logger.debug(f"Processing parameters as: {body_parameters}")

            # Resolve datasets -> absolute paths
            if task_parameters and task_parameters.datasets:
                logger.debug(f"Task has request for datasets: {task_parameters.datasets}")
                for key_dataset, ids_dataset in task_parameters.datasets.items():
                    if isinstance(ids_dataset, list):
                        ids = ids_dataset
                        logger.debug("Received list of datasets")
                    else:
                        ids = [ids_dataset]
                        logger.debug("Received a single dataset")

                    abspaths_list: list[str] = []
                    for id_dataset in ids:
                        logger.debug(f"Getting path for dataset with ID {id_dataset}")
                        abspath = DatasetRepository.get_abspath(id_dataset)
                        logger.debug(f"Got path: {abspath}")
                        abspaths_list.append(abspath)

                    abspaths_str = ",".join(abspaths_list)
                    logger.debug(f"Finished listing datasets for {key_dataset} with paths: {abspaths_str}")
                    body_parameters[key_dataset] = abspaths_str
                    logger.debug(f"Processed dataset locations as: {abspaths_str}")

            logger.debug(f"Final body parameters are: {body_parameters}")

            # -------- Immunarch pre-flight cache check --------
            if action.codename == "r-immunarch-compute-stats":
                # hash on raw request (IDs/strings), not resolved filesystem paths
                cache_key = compute_task_hash(action.codename, raw_params, raw_datasets)
                cache_dir = os.path.join("data", "cache", cache_key)
                done_marker = os.path.join(cache_dir, "done.marker")
                logger.debug(f"Checking cache at {cache_dir} for key {cache_key}")

                if os.path.exists(done_marker):
                    # Materialize cached outputs into this task's output_path
                    os.makedirs(output_path, exist_ok=True)
                    shutil.copytree(cache_dir, output_path, dirs_exist_ok=True)

                    TaskRepository.update_by_user(
                        user.id, task.id,
                        TaskPatch(id_action=action.id, id_process=None, output_path=output_path)
                    )

                    # Reuse the normal saver so datasets get registered exactly like a fresh run
                    NextflowService._save_output_files(output_path, task)
                    TaskRepository.set_finished(user.id, task.id)

                    logger.info(f"Returned cached Immunarch results from {cache_dir} (key={cache_key})")
                    return
            # -------- end pre-flight check --------

            parameters = NextflowService._make_params_string(body_parameters)
            logger.debug(f"Starting task with command parameters: {parameters}")

            process = NextflowService._launch_process(action.script, output_path, parameters)
            logger.debug(f"Task running with PID {process.pid}")

            TaskRepository.update_by_user(
                user.id, task.id, TaskPatch(
                    id_action=action.id,
                    id_process=process.pid,
                    output_path=output_path
                )
            )

            process_stream = NextflowService._poll_process(process)
            logger.debug(f"Finished polling process")

            try:
                NextflowService._eval_output(process, process_stream, output_path)
                TaskRepository.set_finished(user.id, task.id)
            except NfSubprocessException as nfe:
                logger.error(f"Task execution produced an exception but will try to save produced datasets: {nfe}")
                TaskRepository.set_finished(user.id, task.id, TaskStatus.ERROR)
                return

            output_datasets: list[Dataset] = NextflowService._save_output_files(output_path, task)

            TaskRepository.set_finished(user.id, task.id)

            # adding stats support
            if (action.codename == "r-immunarch-compute-stats" and not NextflowService.parse_stats_keyword(task_parameters.parameters, "ignore_cache")):
                if (NextflowService.parse_stats_keyword(task_parameters.parameters, "gene_usage")):
                    StatsCacheRepository.add_cached_result(ids_dataset[0], StatsType.GENE_USAGE, output_datasets)

                # if (NextflowService.parse_stats_keyword(task_parameters.parameters, "repertoire_overlap")):
                    # StatsCacheRepository.add_cached_result(ids_dataset[0], StatsType.REPERTOIRE_OVERLAP, output_datasets)

                if (NextflowService.parse_stats_keyword(task_parameters.parameters, "number_clonotypes")):
                    StatsCacheRepository.add_cached_result(ids_dataset[0], StatsType.NUMBER_CLONOTYPES, output_datasets)

                if (NextflowService.parse_stats_keyword(task_parameters.parameters, "distro_clonotypes")):
                    StatsCacheRepository.add_cached_result(ids_dataset[0], StatsType.DISTRO_CLONOTYPES, output_datasets)

                if (NextflowService.parse_stats_keyword(task_parameters.parameters, "distro_cdr3_length")):
                    StatsCacheRepository.add_cached_result(ids_dataset[0], StatsType.CDR3_LEN, output_datasets)

                if (NextflowService.parse_stats_keyword(task_parameters.parameters, "top_clones")):
                    StatsCacheRepository.add_cached_result(ids_dataset[0], StatsType.TOP_CLONES, output_datasets)

                if (NextflowService.parse_stats_keyword(task_parameters.parameters, "track_clonotypes")):
                    StatsCacheRepository.add_cached_result(ids_dataset[0], StatsType.TRACK_CLONOTYPES, output_datasets)

                if (NextflowService.parse_stats_keyword(task_parameters.parameters, "basic_clonal_proportion")):
                    StatsCacheRepository.add_cached_result(ids_dataset[0], StatsType.CLONAL_PROPORTION, output_datasets)

                if (NextflowService.parse_stats_keyword(task_parameters.parameters, "diversity")):
                    StatsCacheRepository.add_cached_result(ids_dataset[0], StatsType.DIVERSITY, output_datasets)

                if (NextflowService.parse_stats_keyword(task_parameters.parameters, "clonal_networks")):
                    StatsCacheRepository.add_cached_result(ids_dataset[0], StatsType.CLONAL_NETWORKS, output_datasets)

                if (NextflowService.parse_stats_keyword(task_parameters.parameters, "phylo_trees")):
                    StatsCacheRepository.add_cached_result(ids_dataset[0], StatsType.PHYLO_TREES, output_datasets)

        except Exception as e:
            logger.error(f"Task execution produced an exception: {e}")
            TaskRepository.set_finished(user.id, task.id, TaskStatus.ERROR)

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



    @staticmethod
    def install_tool(user: UserData, tool: Tool, task: Task) -> None:
        try:
            logger.debug(f"Installing tool '{tool.name} (id: {tool.id})'")

            output_path = Files.format_action_output_path(str(task.id))

            logger.debug(f"Task output will be placed in {output_path}")

            process = NextflowService._launch_process(tool.install_script, output_path)
            logger.debug(f"Task running with PID {process.pid}")

            TaskRepository.update_by_user(
                user.id, task.id, TaskPatch(
                    id_process=process.pid,
                    output_path=output_path,
                )
            )

            process_stream = NextflowService._poll_process(process)

            NextflowService._eval_output(process, process_stream, output_path)

            TaskRepository.set_finished(user.id, task.id)

            ToolRepository.set_installed(tool.id)
        except Exception as e:
            logger.error(e)
            TaskRepository.set_finished(user.id, task.id, TaskStatus.ERROR)

    @staticmethod
    def kill_task(task: Task):
        os.kill(task.id_process, signal.SIGKILL)

    @staticmethod
    def _make_params_string(params: dict | None) -> list[str]:
        """Creates the parameter setting portion of the nextflow run command."""
        param_list = []

        if not params:
            return param_list

        # Safely convert from Pydantic model if needed
        if not isinstance(params, dict):
            try:
                params = params.dict(exclude_unset=True)
            except AttributeError:
                raise TypeError("params must be a dict or a Pydantic model with `.dict()` method")

        for key, value in params.items():
            if not value:
                param_list.append(f"--{key}=")
            else:
                param_list.append(f"--{key}={value}")

        return param_list

    @staticmethod
    def _poll_process(process: subprocess.Popen) -> Tuple[AnyStr, AnyStr]:
        while True:
            logger.debug(f"Polled running task with PID {process.pid}")

            if not process or process.poll() is not None:
                return process.communicate()

            time.sleep(1)

    @staticmethod
    def _eval_output(process: subprocess.Popen, process_stream: Tuple[AnyStr, AnyStr], output_path: str):
        _, stderr = process_stream

        log_output = Files.get_file_contents(os.path.join(output_path, ".nextflow.log"))
        workloads = nextflow.command.get_process_executions(log_output, output_path)

        # Successful runs
        if process.returncode == 0:
            for workload in workloads:
                logger.debug(f"Finished workload id: {workload.identifier}")
        else:
            error_msg = f"""
            Nextflow process failed with code {process.returncode}.
            STDERR reports the following: {stderr}")
            """
            logger.error(error_msg)

            raise NfSubprocessException(error_msg)

        if process.wait() == 0:
            logger.debug(f"Save output data completed {process.pid}")
        else:
            logger.debug(f"Save output data failed {process.pid}")

    @staticmethod
    def _launch_process(script_path: str, output_path: str, params: list[str] = None) -> subprocess.Popen:
        """
        Launch the actual OS-level process.
        Returns subprocess object
        """

        # Save current directory
        original_dir = os.getcwd()
        config_file = os.path.join(original_dir, "nextflow.config")

        os.chdir(output_path)

        command_args = [
            "nextflow",
            "-log", os.path.join(".nextflow.log"),
            "run",
            os.path.join(original_dir, Files.format_action_scripts_path(script_path)),
            "--work-dir", output_path,
            "-ansi-log", "false",
            "-latest",
            "-c", config_file,
            # "-profile", workflow["profiles"],
            # "-revision", workflow["revision"]
        ]

        if params is not None:
            command_args = command_args + params

        logger.debug(f"Launching command: {' '.join(command_args)}")

        # Only show outputs in debugging mode
        # Note the usage of DEVNULL to supress console output since it's already going to nextflow.log
        cli_output = None if logger.root.level == logging.DEBUG else subprocess.DEVNULL

        env = os.environ.copy()
        env["NXF_DISABLE_CHECK_LATEST"] = "true"
        env["SHARED_DATA_ROOT"] = config.shared_data_root
        env["SHARED_DATA_HOST_PATH"] = os.getenv("SHARED_DATA_HOST_PATH", config.shared_data_root)

        proc = subprocess.Popen(command_args, stdout=cli_output, stderr=subprocess.PIPE, env=env)

        os.chdir(original_dir)

        return proc

    @staticmethod
    def _list_output_files(work_output_path: str) -> list[str]:
        for root, dirs, files in os.walk(work_output_path):
            return [f for f in files if f not in NextflowService._std_work_files]

    @staticmethod
    def _save_output_files(output_path: str, task: Task) -> list[Dataset]:
        execution: nextflow.models.Execution = nextflow.command.get_execution(output_path, "")
        datasets: list[Dataset] = []

        for p in execution.process_executions:
            output_files = NextflowService._list_output_files(p.path)

            logger.debug(f"Number of output files acquired: {len(output_files)}")

            for output_file in output_files:
                logger.debug(f"Output file acquired at: {output_file}")

                output_file_path = os.path.join(p.path, output_file)

                with open(output_file_path, 'r') as f:
                    dataset_create = DatasetCreate(
                        filename=os.path.basename(f.name),
                        filepath=output_file_path,
                        filesize=os.path.getsize(output_file_path),
                        annotated=True,
                        id_task=task.id
                    )

                    dataset = DatasetRepository.create_from_pydantic(dataset_create)
                    datasets.append(dataset)

                    logger.debug(f"Saving Dataset with ID {dataset.id} at {output_file_path}")

        return datasets