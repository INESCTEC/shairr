from typing import Optional

from pydantic import BaseModel, ConfigDict

from schemas.json.airr.TimePoint import AirrTimepoint


class TimePointBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_subject: int
    time_point: float
    id_relative_time_point: Optional[float] = None
    units_of_measurement: str
    description: str

    def as_airr(self):
        return AirrTimepoint(
            study_id=self.study_id,
            study_title=self.study_title,
            study_description=self.study_description,
        )

class TimePointCreate(TimePointBase):
    pass

class TimePointUpdate(TimePointBase):
    id_subject: int
    time_point: Optional[float] = None
    id_relative_time_point: Optional[float] = None
    units_of_measurement: str
    description: str

class TimePointResponse(TimePointBase):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
