from core import Database
from schemas.dao.Common import BaseRepository
from schemas.db.Dataset import Dataset

from schemas.db.Read import Read


class ReadRepository(BaseRepository):
    model = Read

    @classmethod
    def get_by_dataset_id(cls, id_dataset: int) -> Read:
        with Database.SessionManager() as db:
            return db.query(cls.model).join(
                Dataset, cls.model.id == Dataset.id
            ).filter(
                Dataset.id == id_dataset
            ).first()