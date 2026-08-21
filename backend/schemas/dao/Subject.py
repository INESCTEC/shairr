from core import Database
from schemas.dao.Common import BaseRepository
from schemas.dao.TimePoint import TimePointRepository
from schemas.db.Subject import Subject

class SubjectRepository(BaseRepository):
    model = Subject

    @staticmethod
    def get_by_subject_id_and_study(subject_id: str, study_id: int):
        with Database.SessionManager() as db:
            return db.query(Subject).filter(
                Subject.subject_id == subject_id,
                Subject.id_study == study_id
            ).one_or_none()
    
    @staticmethod
    def get_subjects_by_study(study_id: int):
        with Database.SessionManager() as db:
            return db.query(Subject).filter(
                Subject.id_study == study_id
            ).all()

    @classmethod
    def get_by_subject_id(cls, subject_id: str) -> Subject | None:
        with Database.SessionManager() as db:
            return db.query(cls.model).filter(cls.model.id == subject_id).first()
        
    @classmethod
    def get_by_study_id(cls, study_id: str) -> list[Subject] | None:
        with Database.SessionManager() as db:
            return db.query(cls.model).filter(cls.model.id_study == study_id).all()
        
    @classmethod
    def remove(cls, id_study: int) -> bool:
        with Database.SessionManager() as session:
            try:
                study = session.query(cls.model).get(id_study)
                if not study:
                    return False
                session.delete(study)
                session.commit()
                return True
            except Exception as e:
                session.rollback()
                print(f"Error deleting study {id_study}: {e}")
                raise

    @classmethod
    def apply_timeline_template(cls, target_subject_id: int, source_subject_id: int):
        from schemas.dao.TimePoint import TimePointRepository
        from schemas.json.TimePoint import TimePointCreate
        
        source_timepoints = TimePointRepository.get_by_subject(source_subject_id)
        target_timepoints = TimePointRepository.get_by_subject(target_subject_id)
        
        source_timepoints.sort(key=lambda tp: tp.id)
        target_timepoints.sort(key=lambda tp: tp.id)
        
        for i, source_tp in enumerate(source_timepoints):
            if i < len(target_timepoints):
                target_tp = target_timepoints[i]
                TimePointRepository.update(
                    target_tp.id,
                    {
                        "units_of_measurement": source_tp.units_of_measurement,
                        "time_point": source_tp.time_point,
                        "description": source_tp.description,
                        "id_relative_time_point": source_tp.id_relative_time_point
                    }
                )
            else:
                create_json = TimePointCreate(
                    id_subject=target_subject_id,
                    units_of_measurement=source_tp.units_of_measurement,
                    time_point=source_tp.time_point,
                    description=source_tp.description,
                    id_relative_time_point=source_tp.id_relative_time_point
                )
                TimePointRepository.create_from_pydantic(create_json)
        
        for j in range(len(source_timepoints), len(target_timepoints)):
            extra_tp = target_timepoints[j]
            TimePointRepository.remove(extra_tp.id)