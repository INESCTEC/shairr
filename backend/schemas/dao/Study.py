from core.Database import SessionLocal
from schemas.dao.Common import BaseRepository

from schemas.db.Study import Study


class StudyRepository(BaseRepository):
    model = Study

    @classmethod
    def get_by_study_id(cls, study_id: str) -> Study | None:
        with SessionLocal() as session:
            return session.query(cls.model).filter(cls.model.study_id == study_id).one_or_none()
        
    @classmethod
    def get_public_studies(cls) -> list[Study]:
        with SessionLocal() as session:
            return session.query(cls.model).filter(cls.model.public == True).all()
        
    @classmethod
    def get_studies_selected_for_stats(cls, limit: int = 100) -> list[Study]:
        with SessionLocal() as session:
            return session.query(cls.model).filter(cls.model.stats == True).limit(limit=limit).all()
    
    @classmethod
    def toggle_public_status(cls, study_id: int) -> bool:
        with SessionLocal() as session:
            study = session.query(cls.model).get(study_id)
            if study:
                study.public = not study.public 
                session.commit()
                return study.public 
            return False
    
    @classmethod
    def toggle_stats_selection(cls, study_id: int) -> bool:
        with SessionLocal() as session:
            study = session.query(cls.model).get(study_id)
            if study:
                study.stats = not study.stats
                session.commit()
                return study.stats
            return False