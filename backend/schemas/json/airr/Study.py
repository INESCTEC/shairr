from typing import Optional

from pydantic import BaseModel

from schemas.json.airr.Contributor import Contributor
from schemas.json.airr.Ontology import Ontology


class AirrStudy(BaseModel):
    model_config = {"extra": "allow"}

    study_id: Optional[str] = None
    study_title: Optional[str] = None
    study_type: Optional[Ontology] = None
    grants: Optional[str] = None
    contributors: list[Contributor]
