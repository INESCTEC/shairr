from core import Database
from schemas.dao.Common import BaseRepository

from schemas.db.TimePoint import TimePoint


class TimePointRepository(BaseRepository):
    model = TimePoint

    @classmethod
    def get_by_subject(cls, id_subject: int) -> list[TimePoint]:
        with Database.SessionManager() as session:
            return session.query(cls.model).filter(cls.model.id_subject == id_subject).all()
    
    @classmethod
    def get_by_subjects(cls, id_subjects: list[int]) -> list[TimePoint]:
        with Database.SessionManager() as session:
            return session.query(cls.model).filter(cls.model.id_subject.in_(id_subjects)).all()