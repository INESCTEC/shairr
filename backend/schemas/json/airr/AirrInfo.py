from pydantic import BaseModel


class AirrInfo(BaseModel):
    title: str = "AIRR Service"
    description: str = "MiAIRR compatible endpoint"