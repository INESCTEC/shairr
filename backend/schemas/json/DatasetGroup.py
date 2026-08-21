from datetime import datetime

from pydantic import BaseModel, ConfigDict

from schemas.json.Dataset import DatasetResponse


class DatasetGroupCreate(BaseModel):
    name: str

class DatasetGroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    datasets: list[DatasetResponse]
