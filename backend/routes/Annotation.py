import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from core.Auth import OidcWorkflow
from schemas.dao.Annotation import AnnotationRepository
from schemas.json.Annotation import AnnotationResponse, AnnotationUpdate
from schemas.json.User import UserData

router = APIRouter()

logger = logging.getLogger(__name__)

@router.get( "/annotation")
def list_annotations(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)]
) -> list[AnnotationResponse]:
    return AnnotationRepository.get_all()


@router.get("/annotation/{id_annotation}")
def get_annotation(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_annotation: int,
) -> AnnotationResponse:
    annotation = AnnotationRepository.get(id_annotation)

    if not annotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return AnnotationResponse.model_validate(annotation)


@router.put(
    "/annotation/{id_annotation}"
)
def update_annotation(
    id_annotation: int,
    annotation_data: AnnotationUpdate,
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)]
) -> AnnotationResponse:
    annotation = AnnotationRepository.get(id_annotation)

    if not annotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    AnnotationRepository.update(annotation.id, annotation_data.model_dump(exclude_unset=True))
    return AnnotationResponse.model_validate(annotation_data)

@router.delete(
    "/annotation/{id_annotation}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_annotation(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_annotation: int
):
    annotation = AnnotationRepository.get(id_annotation)

    if not annotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    if not AnnotationRepository.remove(id_annotation):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)