import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.Auth import OidcWorkflow
from schemas.dao.Repository import RepositoryRepository
from schemas.json.Repository import RepositoryResponse, RepositoryUpdate
from schemas.json.User import UserData

router = APIRouter()

logger = logging.getLogger(__name__)

@router.get("/repository")
def get_repository(
    _: UserData = Depends(OidcWorkflow.get_userinfo)
) -> RepositoryResponse:
    repository = RepositoryRepository.get(1)

    if not repository:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return RepositoryResponse.model_validate(repository)

@router.put("/repository")
def update_repository(
    repository_update: RepositoryUpdate,
    _: UserData = Depends(OidcWorkflow.get_userinfo)
) -> RepositoryResponse:
    repository = RepositoryRepository.get(1)

    if not repository:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    updated_repository = RepositoryRepository.update(
        1,
        repository_update.model_dump(exclude_unset=True)
    )

    return RepositoryResponse.model_validate(updated_repository)