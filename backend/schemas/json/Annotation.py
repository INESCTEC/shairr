from typing import Optional

from pydantic import BaseModel, ConfigDict


class AnnotationBase(BaseModel):
    id_sample: Optional[int]
    id_read: Optional[int]
    id_dataset: int
    
class AnnotationCreate(AnnotationBase):
    pass

class AnnotationUpdate(AnnotationBase):
    id_sample: Optional[int]
    id_read: Optional[int]
    id_dataset: Optional[int]

class AnnotationResponse(AnnotationBase):
    id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

