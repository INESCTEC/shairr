import os
import logging
from typing import List, Optional

from sqlalchemy.exc import SQLAlchemyError

from core import Database
from core.Config import config
from schemas.dao.Common import BaseRepository
from schemas.dao.Dataset import DatasetRepository
from schemas.db.Dataset import Dataset
from schemas.db.StatsCache import StatsCache
from schemas.db.StatsType import StatsType

logger = logging.getLogger(__name__)


class StatsCacheRepository(BaseRepository):
    model = StatsCache

    @staticmethod
    def get_result(id_input_dataset: int, stat_type: StatsType) -> List[Dataset]:
        """Get cached results - returns empty list if anything fails."""
        try:
            dataset = DatasetRepository.get(id_input_dataset)
            if not dataset:
                logger.warning(f"Dataset {id_input_dataset} not found")
                return []
            
            # Check if file exists where it should
            file_path = dataset.filepath
            if file_path and not os.path.exists(file_path):
                # Try common locations
                filename = os.path.basename(file_path) if file_path else ""
                possible_paths = [
                    file_path,
                    f"./{file_path}",
                    f"../{file_path}",
                    os.path.join(config.dataset_path, filename) if config.dataset_path else None,
                ]
                
                file_exists = False
                for path in possible_paths:
                    if path and os.path.exists(path):
                        file_exists = True
                        break
                
                if not file_exists:
                    logger.warning(f"Dataset file missing for ID {id_input_dataset}, skipping cache check")
                    return []
            
            with Database.SessionManager() as db:
                results = db.query(Dataset).join(
                    StatsCache, StatsCache.id_result_dataset == Dataset.id
                ).filter(
                    StatsCache.id_input_dataset == id_input_dataset,
                    StatsCache.type == stat_type.name
                ).all()
                
                return results
                
        except Exception as e:
            logger.error(f"Error in get_result: {e}")
            return []

    @staticmethod
    def add_cached_result(id_input_dataset: int, stat_type: StatsType, results: List[Dataset]) -> None:
        """Cache results - fails silently."""
        if not results:
            return
        
        try:
            cache_entries = [
                StatsCache(
                    id_input_dataset=id_input_dataset,
                    type=stat_type.name,
                    id_result_dataset=r.id
                ) for r in results
            ]
            
            with Database.SessionManager() as db:
                db.add_all(cache_entries)
                db.commit()
        except Exception as e:
            logger.error(f"Failed to cache results: {e}")
            db.rollback()