from typing import Optional

from pydantic import BaseModel, Field

from schemas.json.airr.AirrInfo import AirrInfo
from schemas.json.airr.DataProcessing import AirrDataProcessing
from schemas.json.airr.Sample import AirrSample
from schemas.json.airr.Study import AirrStudy
from schemas.json.airr.Subject import AirrSubject


class AirrRepertoire(BaseModel):
    model_config = {"extra": "allow"}

    repertoire_id: Optional[str] = None
    repertoire_name: Optional[str] = None
    repertoire_description: Optional[str] = None
    subject: Optional[AirrSubject] = None
    study: Optional[AirrStudy] | None = None
    sample: list[AirrSample] = []
    data_processing: list[AirrDataProcessing] = []

class AirrRepertoireResponse(BaseModel):
    model_config = {
        "extra": "allow",
        "from_attributes": True
    }
    Repertoire: list[AirrRepertoire]
    Info: AirrInfo = Field(default_factory=AirrInfo)
