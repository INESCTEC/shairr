from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from schemas.json.airr.Ontology import Ontology


# https://docs.airr-community.org/en/latest/datarep/metadata.html#diagnosis-fields
class AirrDiagnosis(BaseModel):
    model_config = {"extra": "allow"}

    diagnosis_timepoint: datetime | None = None
    disease_diagnosis: Optional[Ontology] = None
    disease_stage: Optional[str] = None
    immunogen: Optional[str] = None

