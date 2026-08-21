from fastapi import APIRouter, Query, HTTPException
from typing import List
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from schemas.json.Cell import CellTerm, SearchQuery, SearchResult
from ontology import get_cell_ontology

router = APIRouter()

ONTOLOGY_PATH = str(Path(__file__).parent.parent / "ontology" / "owl" / "cell" / "cl-basic.owl")
cell_ontology = get_cell_ontology(ONTOLOGY_PATH)

@router.get("/terms", response_model=List[CellTerm])
async def get_all_terms(skip: int = Query(0, ge=0), limit: int = Query(200, ge=1, le=1000)):
    return cell_ontology.get_all_terms(skip=skip, limit=limit)

@router.get("/terms/{cl_id}", response_model=CellTerm)
async def get_term_by_id(cl_id: str):
    term = cell_ontology.get_term(cl_id)
    if not term:
        raise HTTPException(status_code=404, detail=f"Term with CL ID {cl_id} not found")
    return term

@router.get("/terms/label/{label}", response_model=CellTerm)
async def get_term_by_label(label: str):
    term = cell_ontology.get_term_by_label(label)
    if not term:
        raise HTTPException(status_code=404, detail=f"Term with label '{label}' not found")
    return term

@router.get("/search", response_model=SearchResult)
async def search_terms(q: str = Query(..., min_length=1), limit: int = Query(100, ge=1, le=100)):
    results = cell_ontology.search(q, limit=limit)
    return SearchResult(query=q, results=results, total=len(results))

@router.post("/search", response_model=SearchResult)
async def search_terms_post(search: SearchQuery):
    results = cell_ontology.search(search.query, limit=search.limit)
    return SearchResult(query=search.query, results=results, total=len(results))

@router.get("/hierarchy/{cl_id}")
async def get_hierarchy(cl_id: str, depth: int = Query(2, ge=1, le=5)):
    term = cell_ontology.get_term(cl_id)
    if not term:
        raise HTTPException(status_code=404, detail=f"Term with CL ID {cl_id} not found")
    
    ancestors = []
    for i in range(min(depth, len(term["ancestors"]))):
        if term["ancestors"][i] in cell_ontology.terms:
            ancestors.append(cell_ontology.terms[term["ancestors"][i]])
    
    descendants = []
    for child_id in term.get("children", [])[:depth]:
        if child_id in cell_ontology.terms:
            descendants.append(cell_ontology.terms[child_id])
    
    return {"term": term, "ancestors": ancestors, "descendants": descendants}