import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from core.Auth import OidcWorkflow
from schemas.dao.Diagnosis import DiagnosisRepository
from schemas.json.Diagnosis import DiagnosisResponse, DiagnosisCreate, DiagnosisUpdate
from schemas.json.User import UserData

router = APIRouter()

logger = logging.getLogger(__name__)

@router.get( "/diagnosis")
def list_diagnosiss(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)]
) -> list[DiagnosisResponse]:
    return DiagnosisRepository.get_all()


@router.get("/diagnosis/{id_diagnosis}")
def get_diagnosis(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_diagnosis: int,
) -> DiagnosisResponse:
    diagnosis = DiagnosisRepository.get(id_diagnosis)

    if not diagnosis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return DiagnosisResponse.model_validate(diagnosis)


@router.post(
    "/diagnosis",
    status_code=status.HTTP_201_CREATED
)
def create_diagnosis(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    diagnosis_create: DiagnosisCreate
) -> DiagnosisResponse:
    created = DiagnosisRepository.create_from_pydantic(diagnosis_create)
    return DiagnosisResponse.model_validate(created)


@router.put(
    "/diagnosis/{id_diagnosis}",
    status_code=status.HTTP_204_NO_CONTENT
)
def update_diagnosis(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_diagnosis: int,
    diagnosis_patch: DiagnosisUpdate
):
    diagnosis = DiagnosisRepository.update(id_diagnosis, diagnosis_patch.model_dump(exclude_unset=True))

    if not diagnosis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)


@router.delete(
    "/diagnosis/{id_diagnosis}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_diagnosis(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_diagnosis: int
):
    diagnosis = DiagnosisRepository.get(id_diagnosis)

    if not diagnosis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    if not DiagnosisRepository.remove(id_diagnosis):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)