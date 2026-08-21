from typing import Optional

from pydantic import BaseModel, ConfigDict


class ReadBase(BaseModel):
    id_sample: Optional[int]
    id_dataset: int

class ReadCreate(ReadBase):
    pass

class ReadUpdate(ReadBase):
    id_sample: Optional[int]
    id_dataset: Optional[int]

class ReadResponse(ReadBase):
    id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

