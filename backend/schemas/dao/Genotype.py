from schemas.json.Genotype import GenotypeCreate
from core.Database import SessionLocal
from schemas.dao.Common import BaseRepository

from schemas.db.Genotype import Genotype


class GenotypeRepository(BaseRepository):
    model = Genotype

    @classmethod
    def get_by_name(cls, name: str) -> Genotype | None:
        with SessionLocal() as db:
            return db.query(cls.model).filter(cls.model.name == name).first()
    
    @classmethod
    def get_by_name_and_subject(cls, name: str, id_subject: int) -> Genotype | None:
        with SessionLocal() as db:
            return db.query(cls.model).filter(
                cls.model.name == name,
                cls.model.id_subject == id_subject
            ).first()
    
    @classmethod
    def get_by_subject_id(cls, id_subject: int) -> list[Genotype]:
        with SessionLocal() as db:
            return db.query(cls.model).filter(cls.model.id_subject == id_subject).all()
        
    @classmethod
    def remove_by_subject_id(cls, id_subject: int) -> bool:
        with SessionLocal() as db:
            query = db.query(cls.model).filter(cls.model.id_subject == id_subject)

            if not query.first():
                return False

            query.delete(synchronize_session=False)

            db.commit()

            return True
    
    @classmethod
    def create_bulk(cls, genotypes: list[GenotypeCreate]) -> list[Genotype]:
        with SessionLocal() as db:
            db.add_all(genotypes)
            db.commit()
            for genotype in genotypes:
                db.refresh(genotype)
            return genotypes

    @classmethod
    def get_genotypes_by_subject(cls) -> dict:
        result: dict[int, list[Genotype]] = {}
        with SessionLocal() as db:
            genotypes = db.query(cls.model).all() 

            for genotype in genotypes:
                subject_id = genotype.id_subject
                
                if subject_id not in result:
                    result[subject_id] = []
                
                result[subject_id].append(genotype)
        
        return result