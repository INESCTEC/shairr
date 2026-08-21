from pydantic import BaseModel


class Ontology(BaseModel):
    model_config = {"extra": "allow"}

    id: str | None = None
    label: str | None = None