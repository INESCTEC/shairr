from fastapi import APIRouter, Query, HTTPException
from typing import List
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from schemas.json.Uberon import UberonTerm, SearchQuery, SearchResult
from ontology import get_uberon_ontology

router = APIRouter()

ONTOLOGY_PATH = str(Path(__file__).parent.parent / "ontology" / "owl" / "uberon" / "uberon-basic.owl")
uberon_ontology = get_uberon_ontology(ONTOLOGY_PATH)

@router.get("/terms", response_model=List[UberonTerm])
async def get_all_terms(skip: int = Query(0, ge=0), limit: int = Query(200, ge=1, le=1000)):
    return uberon_ontology.get_all_terms(skip=skip, limit=limit)

@router.get("/terms/{uberon_id}", response_model=UberonTerm)
async def get_term_by_id(uberon_id: str):
    term = uberon_ontology.get_term(uberon_id)
    if not term:
        raise HTTPException(status_code=404, detail=f"Term with UBERON ID {uberon_id} not found")
    return term

@router.get("/terms/label/{label}", response_model=UberonTerm)
async def get_term_by_label(label: str):
    term = uberon_ontology.get_term_by_label(label)
    if not term:
        raise HTTPException(status_code=404, detail=f"Term with label '{label}' not found")
    return term

@router.get("/search", response_model=SearchResult)
async def search_terms(q: str = Query(..., min_length=1), limit: int = Query(100, ge=1, le=100)):
    results = uberon_ontology.search(q, limit=limit)
    return SearchResult(query=q, results=results, total=len(results))

@router.post("/search", response_model=SearchResult)
async def search_terms_post(search: SearchQuery):
    results = uberon_ontology.search(search.query, limit=search.limit)
    return SearchResult(query=search.query, results=results, total=len(results))

@router.get("/hierarchy/{uberon_id}")
async def get_hierarchy(uberon_id: str, depth: int = Query(2, ge=1, le=5)):
    term = uberon_ontology.get_term(uberon_id)
    if not term:
        raise HTTPException(status_code=404, detail=f"Term with UBERON ID {uberon_id} not found")
    
    ancestors = []
    for i in range(min(depth, len(term["ancestors"]))):
        if term["ancestors"][i] in uberon_ontology.terms:
            ancestors.append(uberon_ontology.terms[term["ancestors"][i]])
    
    descendants = []
    for child_id in term.get("children", [])[:depth]:
        if child_id in uberon_ontology.terms:
            descendants.append(uberon_ontology.terms[child_id])
    
    return {"term": term, "ancestors": ancestors, "descendants": descendants}