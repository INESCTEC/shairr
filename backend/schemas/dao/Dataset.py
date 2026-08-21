import os
import logging

from core import Database
from schemas.dao.Common import BaseRepository
from schemas.db.Dataset import Dataset

logger = logging.getLogger(__name__)


class DatasetRepository(BaseRepository):
    model = Dataset

    @staticmethod
    def get_all_datasets(limit: int = None, page: int = 1, search: str = "") -> list[Dataset]:
        offset = None

        if limit:
            offset = (page - 1) * limit

        with Database.SessionManager() as db:
            query = db.query(Dataset).filter(Dataset.filename.contains(search))
            
            if offset:
                query = query.limit(limit).offset(offset)

            return query.all()
        
    @classmethod
    def get_all_in(cls, ids: list[int]) -> list[Dataset]:
        with Database.SessionManager() as db:
            return db.query(cls.model).filter(cls.model.id.in_(ids)).all()
    
    @staticmethod
    def get_abspath(id_dataset: int) -> str:
        dataset = DatasetRepository.get(id_dataset)
        if not dataset:
            raise FileNotFoundError(f"Dataset with ID {id_dataset} does not exist")
        
        # Convert to absolute path based on backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        abs_filepath = os.path.join(backend_dir, dataset.filepath)
        
        logger.debug(f"Looking for dataset file: {abs_filepath}")
        
        # Try the path as-is
        if os.path.exists(abs_filepath):
            return abs_filepath
        
        # Try with extensions
        for ext in ['.tsv', '.fastq', '.fasta', '.csv']:
            test_path = abs_filepath + ext
            if os.path.exists(test_path):
                logger.debug(f"Found with extension {ext}: {test_path}")
                return test_path
        
        logger.error(f"File not found: {abs_filepath}")
        raise FileNotFoundError(f"Dataset file not found: {abs_filepath}")