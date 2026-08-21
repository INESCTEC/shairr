from typing import Optional

from pydantic import BaseModel, ConfigDict

from schemas.db.Ontology import Ontology
from schemas.json.airr.Diagnosis import AirrDiagnosis


class DiagnosisBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    disease_diagnosis: Optional[Ontology]
    disease_stage: Optional[str]
    immunogen: Optional[str]
    id_subject: Optional[int]

    def as_airr(self):
        return AirrDiagnosis(
            disease_diagnosis=self.disease_diagnosis,
            disease_stage=self.disease_stage,
            immunogen=self.immunogen
        )

class DiagnosisCreate(DiagnosisBase):
    pass

class DiagnosisUpdate(DiagnosisBase):
    disease_diagnosis: Optional[Ontology]
    disease_stage: Optional[str]
    immunogen: Optional[str]
    id_subject: Optional[int]

class DiagnosisResponse(DiagnosisBase):
    id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)