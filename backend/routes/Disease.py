# app/api/endpoints/disease_ontology.py
from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional

import sys
from pathlib import Path

# Add the parent directory to Python path
sys.path.append(str(Path(__file__).parent.parent))

from schemas.json.Disease import DiseaseTerm, SearchQuery, SearchResult
from ontology.Disease import DiseaseOntology

router = APIRouter()

# Initialize ontology
# Adjust the path to your OWL file
ONTOLOGY_PATH = str(Path(__file__).parent.parent / "ontology" / "owl" / "disease" / "doid-base.owl")
from ontology import get_disease_ontology
disease_ontology = get_disease_ontology(ONTOLOGY_PATH)

@router.get("/terms", response_model=List[DiseaseTerm])
async def get_all_terms(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000)
):
    """Get paginated list of all disease terms"""
    return disease_ontology.get_all_terms(skip=skip, limit=limit)

@router.get("/terms/{doid}", response_model=DiseaseTerm)
async def get_term_by_id(doid: str):
    """Get a specific disease term by DOID"""
    term = disease_ontology.get_term(doid)
    if not term:
        raise HTTPException(status_code=404, detail=f"Term with DOID {doid} not found")
    return term

@router.get("/terms/label/{label}", response_model=DiseaseTerm)
async def get_term_by_label(label: str):
    """Get a disease term by its label"""
    term = disease_ontology.get_term_by_label(label)
    if not term:
        raise HTTPException(status_code=404, detail=f"Term with label '{label}' not found")
    return term

@router.get("/search", response_model=SearchResult)
async def search_terms(
    q: str = Query(..., min_length=1),
    limit: int = Query(100, ge=1, le=100)
):
    """Search for disease terms"""
    results = disease_ontology.search(q, limit=limit)
    return SearchResult(
        query=q,
        results=results,
        total=len(results)
    )

@router.post("/search", response_model=SearchResult)
async def search_terms_post(search: SearchQuery):
    """Search for disease terms (POST version)"""
    results = disease_ontology.search(search.query, limit=search.limit)
    return SearchResult(
        query=search.query,
        results=results,
        total=len(results)
    )

@router.get("/hierarchy/{doid}")
async def get_hierarchy(doid: str, depth: int = Query(2, ge=1, le=5)):
    """Get hierarchical structure around a term"""
    term = disease_ontology.get_term(doid)
    if not term:
        raise HTTPException(status_code=404, detail=f"Term with DOID {doid} not found")
    
    # Get ancestors up to specified depth
    ancestors = []
    current_term = term
    for i in range(min(depth, len(term["ancestors"]))):
        if term["ancestors"][i] in disease_ontology.terms:
            ancestors.append(disease_ontology.terms[term["ancestors"][i]])
    
    # Get descendants up to specified depth
    descendants = []
    for child_id in term.get("children", [])[:depth]:
        if child_id in disease_ontology.terms:
            descendants.append(disease_ontology.terms[child_id])
    
    return {
        "term": term,
        "ancestors": ancestors,
        "descendants": descendants
    }