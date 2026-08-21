from core import Database
from schemas.dao.Common import BaseRepository

from schemas.db.DatasetGroup import DatasetGroup


class DatasetGroupRepository(BaseRepository):
    model = DatasetGroup

    @staticmethod
    def get_all_dataset_groups(limit: int = None, page: int = 1, search: str = "") -> list[DatasetGroup]:
        offset = None

        if limit:
            offset = (page - 1) * limit

        with Database.SessionManager() as db:
            query = db.query(DatasetGroup).filter(DatasetGroup.name.contains(search))

            if offset:
                query = query.limit(limit).offset(offset)

            return query.all()
        
    @classmethod
    def get_all_in(cls, ids: list[int]) -> list[DatasetGroup]:
        with Database.SessionManager() as db:
            return db.query(cls.model).filter(cls.model.id.in_(ids)).all()