from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from schemas.db.Ontology import Ontology
from schemas.json.Diagnosis import DiagnosisResponse
from schemas.json.airr.Subject import Genotype, AirrSubject
from schemas.json.Genotype import GenotypeBase

class SubjectBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_study: int
    subject_id: str
    synthetic: Optional[bool]
    species: Optional[Ontology]

    @classmethod
    def from_db_model(cls, subject_db):
        """Convert from SQLAlchemy model to Pydantic model"""
        # Get the base attributes
        subject_dict = {
            'id': subject_db.id,
            'diagnosis': subject_db.diagnosis,
            'id_study': subject_db.id_study,
            'subject_id': subject_db.subject_id,
            'synthetic': subject_db.synthetic,
            'species': subject_db.species,
        }
        
        # Handle genotypes separately
        if hasattr(subject_db, 'genotypes') and subject_db.genotypes is not None:
            genotypes = []
            for genotype in subject_db.genotypes:
                if hasattr(genotype, '__dict__'):
                    # Include ALL required fields from GenotypeBase
                    genotype_dict = {
                        'id': getattr(genotype, 'id', None),
                        'id_subject': getattr(genotype, 'id_subject', subject_db.id),  # Use subject_db.id as fallback
                        'name': getattr(genotype, 'name', None),
                        'mhc_class': getattr(genotype, 'mhc_class', None),
                        # Add any other fields your GenotypeBase requires
                    }
                    genotypes.append(GenotypeBase.model_validate(genotype_dict))
                else:
                    genotypes.append(genotype)
            subject_dict['genotypes'] = genotypes
            
        return cls.model_validate(subject_dict)

    def as_airr(self) -> AirrSubject:
        genotype = None

        if hasattr(self, 'genotypes') and self.genotypes:
            genotypes_list = []
            for g in self.genotypes:
                if hasattr(g, 'name') and hasattr(g, 'mhc_class'):
                    genotypes_list.append({"name": g.name, "mhc_class": g.mhc_class})
                elif isinstance(g, dict):
                    genotypes_list.append({"name": g.get('name'), "mhc_class": g.get('mhc_class')})
            genotype = genotypes_list if genotypes_list else None

        return AirrSubject(
            subject_id=self.subject_id,
            synthetic=self.synthetic if self.synthetic is not None else False,
            species=self.species,
            genotype=genotype,
            diagnosis=self.diagnosis if hasattr(self, 'diagnosis') and self.diagnosis else None
        )

class SubjectCreate(SubjectBase):
    id_study: Optional[int] = None
    pass

class SubjectUpdate(SubjectBase):
    id_study: Optional[int] = None
    subject_id: Optional[str] = None
    synthetic: Optional[bool] = None
    species: Optional[Ontology] = None

class SubjectResponse(SubjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[int] = None
    diagnosis: Optional[list[DiagnosisResponse]] = None
    genotypes: Optional[List[GenotypeBase]] = None 