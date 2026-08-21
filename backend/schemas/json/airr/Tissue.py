from typing import Optional

from pydantic import BaseModel

from schemas.json.airr.Ontology import Ontology


class AirrTissue(BaseModel):
    cell_subset: Optional[Ontology] = None
    cell_phenotype: Optional[str] = None