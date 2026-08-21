from typing import Literal, Optional

from pydantic import BaseModel, Field


# Based on AIRR filters
#   https://docs.airr-community.org/en/latest/api/adc_api_endpoints.html

class AirrFilterContent(BaseModel):
    field: str
    value: str | list[str]

class AirrFilterItem(BaseModel):
    op: Literal["=", "in", ">", "<", ">=", "<="]
    content: AirrFilterContent


class AirrFilters(BaseModel):
    op: Literal["and", "or", "=","in", ">", "<", ">=", "<="]
    # Accept:
    #  - a simple content object (field + value)
    #  - a single AirrFilterItem (op + content)
    #  - a list of AirrFilterItem (for and/or, etc.)
    content: AirrFilterContent | AirrFilterItem | list[AirrFilterItem]


class AirrQueryModel(BaseModel):
    filters: Optional[AirrFilters]
    fields: list[str] = Field(default_factory=list)
    size: Optional[int] = None
    format: Literal["tsv", "json"]

