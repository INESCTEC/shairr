import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from core.Auth import OidcWorkflow
from schemas.dao.TimePoint import TimePointRepository
from schemas.json.TimePoint import TimePointResponse, TimePointCreate, TimePointUpdate
from schemas.json.User import UserData

router = APIRouter()

logger = logging.getLogger(__name__)

@router.get("/timepoint")
def list_timePoints(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)]
) -> list[TimePointResponse]:
    return TimePointRepository.get_all()


@router.get("/timepoint/{id_timePoint}")
def get_timePoint(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_timePoint: int,
) -> TimePointResponse:
    timePoint = TimePointRepository.get(id_timePoint)

    if not timePoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return TimePointResponse.model_validate(timePoint)

@router.get("/timepoint/subject/{id_subject}")
def get_timePoints_by_subject(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_subject: int,
) -> list[TimePointResponse]:
    timePoints = TimePointRepository.get_by_subject(id_subject)
    return [TimePointResponse.model_validate(tp) for tp in timePoints]

@router.post(
    "/timepoint",
    status_code=status.HTTP_201_CREATED
)
def create_timePoint(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    timePoint_create: TimePointCreate
) -> TimePointResponse:
    created = TimePointRepository.create_from_pydantic(timePoint_create)
    return TimePointResponse.model_validate(created)


@router.put(
    "/timepoint/{id_timePoint}",
    status_code=status.HTTP_204_NO_CONTENT
)
def update_timePoint(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_timePoint: int,
    timePoint_patch: TimePointUpdate
):
    timePoint = TimePointRepository.get(id_timePoint)

    if not timePoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    update_data = timePoint_patch.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    
    updated = TimePointRepository.update(id_timePoint, update_data)
    
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)


@router.delete(
    "/timepoint/{id_timePoint}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_timePoint(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_timePoint: int
):
    timePoint = TimePointRepository.get(id_timePoint)

    if not timePoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    if not TimePointRepository.remove(id_timePoint):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
@router.get("/timepoints/subjects", status_code=status.HTTP_200_OK)
def get_timepoints_by_subjects(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    ids: str
) -> list[TimePointResponse]:
    subject_ids = [int(id) for id in ids.split(',') if id.isdigit()]
    timePoints = TimePointRepository.get_by_subjects(subject_ids)

    return [TimePointResponse.model_validate(tp) for tp in timePoints]