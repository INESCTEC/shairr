
from typing import Optional

from pydantic import BaseModel


class Contributor(BaseModel):
    name: str
    contact: Optional[str] = None