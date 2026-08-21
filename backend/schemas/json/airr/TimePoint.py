from typing import Optional

from pydantic import BaseModel


class AirrTimepoint(BaseModel):
    model_config = {"extra": "allow"}

    collection_time_point_relative: Optional[str] = None
    disease_state_sample: Optional[str] = None
