from core import Database
from schemas.dao.Common import BaseRepository
from schemas.db.Sample import Sample
from schemas.dao.Subject import SubjectRepository

class SampleRepository(BaseRepository):
    model = Sample

    @staticmethod
    def get_by_sample_id_and_subject(sample_id: str, subject_id: int):
        with Database.SessionManager() as db:
            return db.query(Sample).filter(
                Sample.sample_id == sample_id,
                Sample.id_subject == subject_id
            ).one_or_none()

    @classmethod
    def get_by_subject(cls, id_subject: str) -> list[Sample]:
        with Database.SessionManager() as db:
            return db.query(cls.model).where(cls.model.id_subject == id_subject).all()
        
    @classmethod
    def get_by_sample_id(cls, sample_id: str) -> Sample | None:
        with Database.SessionManager() as db:
            return db.query(cls.model).filter(cls.model.sample_id == sample_id).one_or_none()
        
    @classmethod
    def get_by_subject_id(cls, subject_id: int) -> list[Sample] | None:
        with Database.SessionManager() as db:
            return db.query(cls.model).filter(cls.model.id_subject == subject_id).all()
        
    @classmethod
    def get_by_study_id(cls, study_id: int) -> list[Sample] | None:
        with Database.SessionManager() as db:
            subjects = SubjectRepository.get_by_study_id(study_id)
            
            # Flatten the list using list comprehension
            samples = [
                sample
                for subject in subjects
                for sample in (SampleRepository.get_by_subject_id(subject.id) or [])
            ]
            
            return samples if samples else None
        
    @classmethod
    def create_from_pydantic(cls, model_create):
        return super().create_from_pydantic(model_create)
