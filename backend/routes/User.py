import logging
from typing import Annotated

from fastapi import APIRouter, Depends, status, HTTPException

from core.Auth import OidcWorkflow
from schemas.dao.User import UserRepository
from schemas.json.User import UserData, UserResponse, UserPatch

router = APIRouter()

logger = logging.getLogger(__name__)


@router.get("/user")
def get_user(
    user: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
) -> UserResponse:
    user = UserRepository.get(user.id_keycloak)

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return UserResponse.model_validate(user)

@router.put(
    "/user",
    status_code=status.HTTP_201_CREATED
)
def update_user(
    user: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    user_patch: UserPatch
) -> UserResponse:
    updated = UserRepository.update_by_id_keycloak(user.id_keycloak, user_patch)
    return UserResponse.model_validate(updated)
