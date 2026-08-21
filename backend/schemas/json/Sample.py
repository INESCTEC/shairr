import json
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from schemas.db.Ontology import Ontology
from schemas.json.airr.Sample import AirrSample


class SampleBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_study: Optional[int]
    id_subject: int
    id_timepoint: Optional[int] = None
    sample_id: str
    sample_type: Optional[str]
    tissue: Optional[Ontology]
    cell_subset: Optional[Ontology]
    cell_phenotype: Optional[str]
    sequencing_type: Optional[str]
    
    def as_airr(self):
        return AirrSample(
            sample_processing_id=self.sample_id,
            sample_type=self.sample_type,
            sample_id=self.sample_id,
            tissue=self.tissue if self.tissue else None,
            cell_subset=self.cell_subset if self.cell_subset else None,
            cell_phenotype=self.cell_phenotype,
            sequencing_type=self.sequencing_type
        )
        

class SampleCreate(SampleBase):
    pass

class SampleUpdate(SampleBase):
    id_subject: Optional[int]
    sample_type: Optional[str]
    sample_id: Optional[str]
    id_timepoint: Optional[int] = None
    tissue: Optional[Ontology]
    cell_subset: Optional[Ontology]
    cell_phenotype: Optional[str]
    sequencing_type: Optional[str]

class SampleResponse(BaseModel):
    id: int
    sample_id: str
    tissue: dict | None = None
    cell_subset: dict | None = None
    cell_phenotype: str | None = None
    sample_type: str | None = None
    sequencing_type: str | None = None
    id_subject: int
    id_study: int
    id_timepoint: int | None = None
    
    @field_validator('tissue', 'cell_subset', mode='before')
    @classmethod
    def parse_ontology(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return None
        return v


