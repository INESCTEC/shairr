from pydantic import BaseModel


class AirrInfoResponse(BaseModel):
    title: str = "AIRR Service"
    description: str = "MiAIRR compatible endpoint"