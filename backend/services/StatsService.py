import logging

from schemas.dao.StatsCache import StatsCacheRepository
from schemas.db import Dataset
from schemas.db.StatsType import StatsType
from schemas.json.Task import TaskParameters

logger = logging.getLogger(__name__)

class StatsService:
    @staticmethod
    def get_result_from_cache(id_user: int, task_parameters: TaskParameters) -> list[Dataset]:
        task_parameters_dump = task_parameters.model_dump() if task_parameters.parameters else None

        logger.debug(f"Task received inputs: {task_parameters}")

        body_parameters = task_parameters_dump[
            'parameters'] if task_parameters_dump and 'parameters' in task_parameters_dump \
            else {}

        input_dataset_id: int

        if task_parameters and task_parameters.datasets:
            logger.debug(f"Task has request for datasets: {task_parameters.datasets}")

            for key_dataset, ids_dataset in task_parameters.datasets.items():
                # normalize to a list of ints
                if isinstance(ids_dataset, list):
                    input_dataset_id = ids_dataset[0]
                    logger.debug("Received list of datasets")
                else:
                    input_dataset_id = ids_dataset
                    logger.debug("Received a single dataset")
        stats_type: StatsType

        # adding stats support
        if (StatsService.parse_stats_keyword(task_parameters.parameters, "gene_usage")):
            stats_type = StatsType.GENE_USAGE

        if (StatsService.parse_stats_keyword(task_parameters.parameters, "repertoire_overlap")):
            stats_type = StatsType.REPERTOIRE_OVERLAP

        if (StatsService.parse_stats_keyword(task_parameters.parameters, "number_clonotypes")):
            stats_type = StatsType.NUMBER_CLONOTYPES

        if (StatsService.parse_stats_keyword(task_parameters.parameters, "distro_clonotypes")):
            stats_type = StatsType.DISTRO_CLONOTYPES

        if (StatsService.parse_stats_keyword(task_parameters.parameters, "distro_cdr3_length")):
            stats_type = StatsType.CDR3_LEN

        if (StatsService.parse_stats_keyword(task_parameters.parameters, "top_clones")):
            stats_type = StatsType.TOP_CLONES
            
        if (StatsService.parse_stats_keyword(task_parameters.parameters, "track_clonotypes")):
            stats_type = StatsType.TRACK_CLONOTYPES

        if (StatsService.parse_stats_keyword(task_parameters.parameters, "basic_clonal_proportion")):
            stats_type = StatsType.CLONAL_PROPORTION

        if (StatsService.parse_stats_keyword(task_parameters.parameters, "diversity")):
            stats_type = StatsType.DIVERSITY

        if (StatsService.parse_stats_keyword(task_parameters.parameters, "clonal_networks")):
            stats_type = StatsType.CLONAL_NETWORKS

        if (StatsService.parse_stats_keyword(task_parameters.parameters, "phylo_trees")):
            stats_type = StatsType.PHYLO_TREES

        cache_entry = StatsCacheRepository.get_result(input_dataset_id, stats_type)

        return cache_entry

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
