from pydantic import BaseModel

from schemas.json.airr.Repertoire import AirrRepertoire


class RepertoireBody(BaseModel):
    Repertoire: list[AirrRepertoire] = []