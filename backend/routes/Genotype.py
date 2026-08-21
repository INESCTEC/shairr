import logging
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status

from core.Auth import OidcWorkflow
from schemas.dao.Genotype import GenotypeRepository
from schemas.json.Genotype import BulkGenotypeCreate, BulkGenotypeDelete, GenotypeResponse, GenotypeCreate
from schemas.json.User import UserData

router = APIRouter()

logger = logging.getLogger(__name__)

   
@router.post(
    "/genotype/bulk",
    status_code=status.HTTP_207_MULTI_STATUS
)
def create_genotypes_bulk(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    payload: BulkGenotypeCreate
) -> dict:
    results = []
    created_count = 0
    failed_count = 0
    
    for subject_id in payload.subject_ids:
        existing = GenotypeRepository.get_by_name_and_subject(
            name=payload.allele_name,
            id_subject=subject_id
        )
        
        if existing:
            results.append({
                "subject_id": subject_id,
                "status": "conflict",
                "detail": f"Allele {payload.allele_name} already exists for subject {subject_id}"
            })
            failed_count += 1
            continue
        
        genotype = GenotypeCreate(
            name=payload.allele_name,
            mhc_class=payload.allele_class,
            id_subject=subject_id
        )
        
        created = GenotypeRepository.create_from_pydantic(genotype)
        results.append({
            "subject_id": subject_id,
            "status": "created",
            "detail": f"Allele {payload.allele_name} added successfully",
            "genotype_id": created.id
        })
        created_count += 1
    
    return {
        "total": len(payload.subject_ids),
        "created": created_count,
        "failed": failed_count,
        "results": results
    }

@router.delete(
    "/genotype/bulk",
    status_code=status.HTTP_207_MULTI_STATUS
)
def delete_genotypes_bulk(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    payload: BulkGenotypeDelete
) -> dict:
    results = []
    deleted_count = 0
    not_found_count = 0
    
    for subject_id in payload.subject_ids:
        genotype = GenotypeRepository.get_by_name_and_subject(
            name=payload.allele_name,
            id_subject=subject_id
        )
        
        if not genotype:
            results.append({
                "subject_id": subject_id,
                "status": "not_found",
                "detail": f"Allele {payload.allele_name} not found for subject {subject_id}"
            })
            not_found_count += 1
            continue
        
        if GenotypeRepository.remove(genotype.id):
            results.append({
                "subject_id": subject_id,
                "status": "deleted",
                "detail": f"Allele {payload.allele_name} removed successfully"
            })
            deleted_count += 1
        else:
            results.append({
                "subject_id": subject_id,
                "status": "error",
                "detail": f"Failed to remove allele {payload.allele_name}"
            })
            not_found_count += 1
    
    return {
        "total": len(payload.subject_ids),
        "deleted": deleted_count,
        "failed": not_found_count,
        "results": results
    }

@router.get("/genotype")
def list_genotypes(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)]
) -> list[GenotypeResponse]:
    genotypes = GenotypeRepository.get_all()
    return [GenotypeResponse.model_validate(genotype) for genotype in genotypes]

@router.get("/genotype/subjects")
def list_genotypes_by_subject(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)]
) -> dict:
    result = GenotypeRepository.get_genotypes_by_subject()
    converted_result = {}
    for subject_id, genotypes in result.items():
        converted_result[subject_id] = [GenotypeResponse.model_validate(g) for g in genotypes]
    return converted_result

@router.get("/genotype/{id_genotype}")
def get_genotype(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_genotype: int
) -> GenotypeResponse:
    genotype = GenotypeRepository.get(id_genotype)

    if not genotype:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return GenotypeResponse.model_validate(genotype)

@router.get('/genotype/subject/{id_subject}')
def get_genotypes_by_subject(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_subject: int
) -> list[GenotypeResponse]:
    genotypes = GenotypeRepository.get_by_subject_id(id_subject)

    return [GenotypeResponse.model_validate(genotype) for genotype in genotypes]

@router.post(
    "/genotype",
    status_code=status.HTTP_201_CREATED
)
def create_genotype(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    genotype: GenotypeCreate
) -> GenotypeResponse:
    existing = GenotypeRepository.get_by_name_and_subject(
        name=genotype.name, 
        id_subject=genotype.id_subject
    )
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Allele {genotype.name} already exists for this subject"
        )
    
    created = GenotypeRepository.create_from_pydantic(genotype)
    return GenotypeResponse.model_validate(created)

@router.delete(
    "/genotype/{id_genotype}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_genotype(
    id_genotype: int,
    user: UserData = Depends(OidcWorkflow.get_userinfo)
):
    genotype = GenotypeRepository.get(id_genotype)

    if not genotype:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    if not GenotypeRepository.remove(id_genotype):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
 