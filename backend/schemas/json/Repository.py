from typing import Optional

from pydantic import BaseModel, ConfigDict


class RepositoryBase(BaseModel):
    name: str

class RepositoryCreate(RepositoryBase):
    pass

class RepositoryUpdate(RepositoryBase):
    name: Optional[str] = None

class RepositoryResponse(RepositoryBase):
    id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)



