from typing import Optional

from pydantic import BaseModel

from schemas.json.airr.Diagnosis import AirrDiagnosis
from schemas.json.airr.Ontology import Ontology


class Genotype(BaseModel):
    name: str
    mhc_class: str

class AirrSubject(BaseModel):
    model_config = {"extra": "allow"}

    subject_id: Optional[str] = None
    synthetic: bool
    species: Ontology
    genotype: Optional[list[Genotype]] = []
    diagnosis: Optional[list[AirrDiagnosis]]  
