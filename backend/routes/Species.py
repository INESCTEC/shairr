# app/api/endpoints/species_ontology.py
from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
from pathlib import Path
import sys

# Add the parent directory to Python path
sys.path.append(str(Path(__file__).parent.parent))

from schemas.json.Species import SpeciesTerm, SearchQuery, SearchResult
from ontology.Species import SpeciesOntology

router = APIRouter()

# Initialize ontology
ONTOLOGY_PATH = str(Path(__file__).parent.parent / "ontology" / "owl" / "ncbitaxon" / "taxslim.owl")
from ontology import get_species_ontology
species_ontology = get_species_ontology(ONTOLOGY_PATH)

@router.get("/common", response_model=List[SpeciesTerm])
async def get_common_species():
    """Get a list of common laboratory species"""
    return species_ontology.get_common_species()

@router.get("/terms", response_model=List[SpeciesTerm])
async def get_all_terms(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000)
):
    """Get paginated list of all species terms"""
    return species_ontology.get_all_terms(skip=skip, limit=limit)

@router.get("/terms/{taxid}", response_model=SpeciesTerm)
async def get_term_by_id(taxid: str):
    """Get a specific species term by NCBITaxon ID"""
    term = species_ontology.get_term(taxid)
    if not term:
        raise HTTPException(status_code=404, detail=f"Taxon ID {taxid} not found")
    return term

@router.get("/terms/label/{label}", response_model=SpeciesTerm)
async def get_term_by_label(label: str):
    """Get a species term by its label"""
    term = species_ontology.get_term_by_label(label)
    if not term:
        raise HTTPException(status_code=404, detail=f"Taxon with label '{label}' not found")
    return term

@router.get("/search", response_model=SearchResult)
async def search_terms(
    q: str = Query(..., min_length=1),
    limit: int = Query(100, ge=1, le=100)
):
    """Search for species terms"""
    results = species_ontology.search(q, limit=limit)
    return SearchResult(
        query=q,
        results=results,
        total=len(results)
    )

@router.post("/search", response_model=SearchResult)
async def search_terms_post(search: SearchQuery):
    """Search for species terms (POST version)"""
    results = species_ontology.search(search.query, limit=search.limit)
    return SearchResult(
        query=search.query,
        results=results,
        total=len(results)
    )

@router.get("/hierarchy/{taxid}")
async def get_hierarchy(taxid: str, depth: int = Query(2, ge=1, le=5)):
    """Get hierarchical structure around a taxon"""
    term = species_ontology.get_term(taxid)
    if not term:
        raise HTTPException(status_code=404, detail=f"Taxon ID {taxid} not found")
    
    # Get ancestors up to specified depth
    ancestors = []
    for i in range(min(depth, len(term["ancestors"]))):
        if term["ancestors"][i] in species_ontology.terms:
            ancestors.append(species_ontology.terms[term["ancestors"][i]])
    
    # Get descendants up to specified depth
    descendants = []
    for child_id in term.get("children", [])[:depth]:
        if child_id in species_ontology.terms:
            descendants.append(species_ontology.terms[child_id])
    
    return {
        "term": term,
        "ancestors": ancestors,
        "descendants": descendants
    }