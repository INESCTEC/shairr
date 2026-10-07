from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AirrContact(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    email: Optional[str] = None


class AirrLicense(BaseModel):
    name: str
    url: Optional[str] = None


class AirrInfoResponse(BaseModel):
    """
    AIRR InfoObject, included in the Info block of AIRR responses.
    """
    title: str = "AIRR Service"
    version: Optional[str] = None
    description: Optional[str] = "MiAIRR compatible endpoint"
    contact: Optional[AirrContact] = None
    license: Optional[AirrLicense] = None


class AirrServiceInfoResponse(AirrInfoResponse):
    """
    Response of the ADC API /info endpoint: describes the service,
    the API specification it implements and the AIRR schema it serves.
    """
    model_config = ConfigDict(populate_by_name=True)

    api: AirrInfoResponse
    # "schema" shadows a BaseModel attribute, so it is exposed through an alias
    airr_schema: AirrInfoResponse = Field(alias="schema")
