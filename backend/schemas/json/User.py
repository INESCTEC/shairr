from typing import Optional, Dict, Any

from pydantic import BaseModel, ConfigDict
from pydantic import BaseModel, field_validator

MAX_PROPERTIES = 100
MAX_KEY_LENGTH = 100
MAX_VALUE_LENGTH = 5000

class UserCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_keycloak: str
    properties: Optional[Dict[str, Any]] = None

class UserPatch(BaseModel):
    properties: dict[str, str] | None = None

    @field_validator("properties")
    @classmethod
    def validate_properties(
        cls,
        properties: dict[str, str] | None
    ) -> dict[str, str] | None:
        if properties is None:
            return properties

        if len(properties) > MAX_PROPERTIES:
            raise ValueError(
                f"Maximum number of properties is {MAX_PROPERTIES}."
            )

        sanitized_properties: dict[str, str] = {}

        for key, value in properties.items():
            sanitized_key = key.strip()
            sanitized_value = value.strip()

            if not sanitized_key:
                continue

            if len(sanitized_key) > MAX_KEY_LENGTH:
                raise ValueError(
                    f"Property key '{sanitized_key}' exceeds "
                    f"{MAX_KEY_LENGTH} characters."
                )

            if len(sanitized_value) > MAX_VALUE_LENGTH:
                raise ValueError(
                    f"Property '{sanitized_key}' exceeds "
                    f"{MAX_VALUE_LENGTH} characters."
                )

            sanitized_properties[sanitized_key] = sanitized_value

        return sanitized_properties

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    properties: Optional[Dict[str, Any]] = None

class UserData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_keycloak: str
    roles: list[str] | None = [] # Role mapping returned by the authentication service