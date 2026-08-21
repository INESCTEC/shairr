from typing import List, Optional

from pydantic import BaseModel

class ActionResponse(BaseModel):
    id: int
    id_tool: int
    name: str
    name_friendly: str | None
    codename: str
    script: Optional[str]

    class Config:
        from_attributes = True

class ActionCreate(BaseModel):
    id_tool: int
    name: str
    name_friendly: str | None
    codename: str
    script: Optional[str]

    class Config:
        from_attributes = True
