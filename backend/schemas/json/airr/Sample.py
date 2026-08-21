from typing import Optional

from schemas.json.airr.Ontology import Ontology
from schemas.json.airr.TimePoint import AirrTimepoint
from schemas.json.airr.Tissue import AirrTissue


class AirrSample(AirrTissue, AirrTimepoint):
    model_config = {"extra": "allow"}
    sample_processing_id: Optional[str] = None
    sample_type: Optional[str] = None
    sample_id: Optional[str] = None
    tissue: Optional[Ontology] = None
