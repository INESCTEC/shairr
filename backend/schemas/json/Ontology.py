from typing import Optional

from pydantic import BaseModel, ConfigDict


class OntologyBase(BaseModel):
    id: str
    label: str

class OntologyCreate(OntologyBase):
    pass

class OntologyUpdate(OntologyBase):
    id: Optional[str]
    label: Optional[str]

class OntologyResponse(OntologyBase):
    model_config = ConfigDict(from_attributes=True)