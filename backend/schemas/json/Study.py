from typing import Optional

from pydantic import BaseModel, ConfigDict

from schemas.json.airr.Contributor import Contributor
from schemas.json.airr.Study import AirrStudy


class StudyBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    study_id: str
    study_title: str
    study_description: Optional[str]
    contributors: Optional[str]
    public: Optional[bool] = False
    stats: Optional[bool] = False

    def as_airr(self):
        return AirrStudy(
            study_id=self.study_id,
            study_title=self.study_title,
            study_description=self.study_description,
            contributors=[
                Contributor(name=name.strip()) for name in self.contributors.split(",")
            ]
        )

class StudyCreate(StudyBase):
    pass


class StudyUpdate(StudyBase):
    study_id: Optional[str]
    study_title: Optional[str]
    study_description: Optional[str]
    contributors: Optional[str]
    public: Optional[bool]
    stats: Optional[bool]


class StudyResponse(StudyBase):
    id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)
