from typing import Optional

from pydantic import BaseModel


class AirrDataProcessing(BaseModel):
    model_config = {"extra": "allow"}

    data_processing_id: Optional[str] = None
    software_versions: Optional[str] = None
    paired_reads_assembly: Optional[str] = None
    quality_thresholds: Optional[str] = None
    primer_match_cutoffs: Optional[str] = None
    collapsing_method: Optional[str] = None
    data_processing_protocols: Optional[str] = None
    data_processing_files: Optional[list[str]] = None
    germline_database: Optional[str] = None