import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.Auth import OidcWorkflow
from schemas.dao.Read import ReadRepository
from schemas.json.Read import ReadResponse, ReadUpdate
from schemas.json.User import UserData

router = APIRouter()

logger = logging.getLogger(__name__)

@router.get( "/read")
def list_reads(
    user: UserData = Depends(OidcWorkflow.get_userinfo)
) -> list[ReadResponse]:
    return ReadRepository.get_all()

@router.get("/read/{id_read}")
def get_read(
    id_read: int,
    user: UserData = Depends(OidcWorkflow.get_userinfo)
) -> ReadResponse:
    read = ReadRepository.get(id_read)

    if not read:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return ReadResponse.model_validate(read)

@router.put(
    "/read/{id_read}"
)
def update_read(
    id_read: int,
    read_data: ReadUpdate,
    user: UserData = Depends(OidcWorkflow.get_userinfo)
) -> ReadResponse:
    read = ReadRepository.get(id_read)

    if not read:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    ReadRepository.update(id_read, read_data.model_dump(exclude_unset=True))
    return ReadResponse.model_validate(read_data)

@router.delete(
    "/read/{id_read}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_read(
    id_read: int,
    user: UserData = Depends(OidcWorkflow.get_userinfo)
):
    read = ReadRepository.get(id_read)

    if not read:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    if not ReadRepository.remove(id_read):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)