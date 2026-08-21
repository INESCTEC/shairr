from datetime import datetime
from typing import Literal, Optional, Dict, Any

from pydantic import BaseModel, Field, model_validator

from schemas.db.DataType import DataType


class RearrangementCreate(BaseModel):
    id_user: int
    id_sample: Optional[int] = None
    filename: str
    filepath: str
    filesize: float
    type: DataType
    id_task: Optional[int] = None
    properties: Optional[Dict[str, Any]] = None


class RearrangementPatch(BaseModel):
    filename: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None


class RearrangementResponse(BaseModel):
    id: int
    id_user: int
    id_sample: int | None
    id_task: int | None
    filename: str
    filesize: float
    type: DataType
    time_created: datetime | None
    properties: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class AIRRRearrangementCreate(BaseModel):
    external_id_repertoire: Optional[str] = Field(None, description="Repertoire ID on the repository we're going to download from")
    external_id_sample: Optional[str] = Field(None, description="Sample ID on the repository we're going to download from")
    id_sample: int = Field(description="Sample ID on our database")
    repository_url: str
    auth_token: Optional[str] = None

    @model_validator(mode="after")
    def check_oneof(cls, values):
        s = values.external_id_sample
        r = values.external_id_repertoire

        if bool(s) == bool(r):
            raise ValueError(
                "Exactly one of 'sample_id' or 'repertoire_id' must be provided."
            )
        return values


class PDBRearrangementCreate(BaseModel):
    id_pdb: str
    type: Literal["pdb", "fasta"] = "pdb"


class UniProtRearrangementCreate(BaseModel):
    id_uniprot: str = Field(description="UniProt accession, e.g. P04637")


class AlphaFoldRearrangementCreate(UniProtRearrangementCreate):
    pass


class RearrangementCounts(BaseModel):
    antigen_count: int
    sequence_count: int