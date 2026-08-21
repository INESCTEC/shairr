from pydantic import BaseModel

from schemas.db.StatsType import StatsType
from schemas.json.Dataset import DatasetResponse
from schemas.json.Task import TaskCreatedResponse


class StatsCacheCreate(BaseModel):
    id_dataset: int
    type: StatsType
    id_result_dataset: int

class StatsResponse(BaseModel):
    served_from_cache: bool
    result_datasets: list[DatasetResponse] | None
    task_response: TaskCreatedResponse | None