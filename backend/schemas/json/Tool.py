import json

from pydantic import BaseModel, field_validator

from schemas.json.Action import ActionResponse


class ToolInstall(BaseModel):
    force: bool = False

class ToolCreate(BaseModel):
    name: str
    install_script: str | None = None
    installed: bool | None = False
    environment_variables: str | None = None

class ToolResponse(BaseModel):
    id: int
    name: str
    install_script: str
    installed: bool
    actions: list[ActionResponse]

    class Config:
        from_attributes = True


class ToolWithPropsResponse(ToolResponse):
    properties: dict | None = None

    @field_validator("properties", mode="before")
    def parse_properties(cls, v):
        if isinstance(v, str):
            return json.loads(v)  # convert TEXT -> dict/list/etc.
        return v

    class Config:
        from_attributes = True
