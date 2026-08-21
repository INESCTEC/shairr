import random
import string
from typing import Annotated
from copy import copy

from argon2 import PasswordHasher
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, OAuth2AuthorizationCodeBearer
from keycloak import KeycloakOpenID

from core.Config import config
from schemas.dao.User import UserRepository
from schemas.json.User import UserData

# Keycloak configuration settings
openid_config = KeycloakOpenID(
    server_url=config.auth.url + "/",
    client_id=config.auth.client_id,
    realm_name=config.auth.realm,
    client_secret_key=config.auth.client_secret,
    verify=True
)

# Used for FastAPI docs authentication
AUTHORIZATION_URL = (
    f"{config.auth.url}/realms/{config.auth.realm}/protocol/openid-connect/auth"
)

TOKEN_URL = (
    f"{config.auth.url}/realms/{config.auth.realm}/protocol/openid-connect/token"
)

AUTH_DESCRIPTION = (
    f"Use this to acquire a OIDC Access Token. "
    f"Use the Client ID and Client Secret defined in: {config.auth.url}"
)

oauth2_scheme = OAuth2AuthorizationCodeBearer(
    authorizationUrl=AUTHORIZATION_URL,
    tokenUrl=TOKEN_URL,
    description=AUTH_DESCRIPTION,
)

oauth2_scheme_optional = OAuth2AuthorizationCodeBearer(
    authorizationUrl=AUTHORIZATION_URL,
    tokenUrl=TOKEN_URL,
    description=AUTH_DESCRIPTION,
    auto_error=False,
)

bearer_scheme = HTTPBearer(
    description=f"Use this field if you already have an Access Token."
)


def get_token_payload(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
    try:
        return openid_config.decode_token(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),  # "Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_optional_token_payload(
    token: Annotated[str | None, Depends(oauth2_scheme_optional)]
) -> dict | None:
    if token is None:
        return None

    try:
        return openid_config.decode_token(token)
    except Exception as exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exception),
            headers={"WWW-Authenticate": "Bearer"},
        )


class OidcWorkflow:
    @staticmethod
    def get_userinfo(payload: Annotated[dict, Depends(get_token_payload)]) -> UserData:
        user_db = UserRepository.get_or_create(payload.get("sub"))

        user = UserData.model_validate(user_db)

        if 'realm_access' in payload and 'roles' in payload['realm_access']:
            user.roles =  payload['realm_access']['roles']

        return user

    @staticmethod
    def get_optional_userinfo(
            token: Annotated[str | None, Depends(oauth2_scheme_optional)]
    ) -> UserData | None:
        if token is None:
            return None

        try:
            payload = openid_config.decode_token(token)

            user_db = UserRepository.get_or_create(payload.get("sub"))

            user = UserData.model_validate(user_db)

            if "realm_access" in payload and "roles" in payload["realm_access"]:
                user.roles = payload["realm_access"]["roles"]

            return user

        except Exception as exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(exception),
                headers={"WWW-Authenticate": "Bearer"},
            )

class AuthToolkit:
    @staticmethod
    def hash_password(password: str) -> str:
        # Hashes provided password using Argon2 hashing algorithm + custom salt
        ph = PasswordHasher()
        return ph.hash(password, salt=str.encode(config.hash_salt))

    @staticmethod
    def generate_password(length: int = 8) -> str:
        # Generate random password
        return ''.join(random.choice(string.ascii_letters) for i in range(length))

