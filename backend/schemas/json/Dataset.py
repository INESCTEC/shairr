from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DatasetCreate(BaseModel):
    filename: str
    filepath: str
    filesize: float
    line_count: Optional[int] = None
    id_group: Optional[int] = None
    id_task: Optional[int] = None
    annotated: bool

class DatasetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    filesize: float
    filepath: str
    id_group: Optional[int] = None
    line_count: int | None
    time_created: datetime
    annotated: bool
