from typing import Optional, List

from pydantic import BaseModel, ConfigDict


class GenotypeBase(BaseModel):
    name: str
    mhc_class: str
    id_subject: int

class GenotypeCreate(GenotypeBase):
    pass

class GenotypeResponse(GenotypeBase):
    id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class BulkGenotypeCreate(BaseModel):
    allele_name: str
    allele_class: str
    subject_ids: List[int]

class BulkGenotypeDelete(BaseModel):
    allele_name: str
    subject_ids: List[int]