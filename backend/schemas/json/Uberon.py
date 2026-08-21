from pydantic import BaseModel
from typing import List, Optional

class UberonTerm(BaseModel):
    id: str
    label: str
    synonyms: List[str] = []
    definition: Optional[str] = None
    parents: List[str] = []
    children: List[str] = []
    ancestors: List[str] = []
    descendants: List[str] = []

class SearchQuery(BaseModel):
    query: str
    limit: Optional[int] = 20

class SearchResult(BaseModel):
    query: str
    results: List[UberonTerm]
    total: int