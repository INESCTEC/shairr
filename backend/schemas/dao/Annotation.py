from fastapi import HTTPException, status

from core import Database
from schemas.dao.Common import BaseRepository

from schemas.db.Annotation import Annotation
from schemas.db.Sample import Sample
from schemas.db.Study import Study
from schemas.db.Subject import Subject


class AnnotationRepository(BaseRepository):
    model = Annotation

    @classmethod
    def get_by_study_and_subject(cls, study_id: str, subject_id: str) -> list[Annotation]:
        with Database.SessionManager() as db:
            study = db.query(Study).filter(Study.study_id == study_id).first()

            if not study:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail="Provided study doesn't exist.")
            
            subject = db.query(Subject).filter(
                Subject.subject_id == subject_id,
                Subject.id_study == study.id
            ).first()

            if not subject:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail="Provided subject doesn't exist.")
            
            return db.query(Annotation).join(
                Sample, cls.model.id_sample == Sample.id
            ).filter(
                Sample.id_subject == subject.id
            ).all()

    @classmethod
    def get_by_sample_id(cls, sample_id: str) -> Annotation:
        with Database.SessionManager() as db:
            return db.query(Annotation).join(
                Sample, Annotation.id_sample == Sample.id
            ).filter(
                Sample.sample_id == sample_id
            ).first()

    @classmethod
    def get_by_sample_ids(cls, sample_ids: list[str]) -> list[Annotation]:
        with Database.SessionManager() as db:
            return db.query(Annotation).join(
                Sample, Annotation.id_sample == Sample.id
            ).filter(
                Sample.sample_id.in_(sample_ids)
            ).first()