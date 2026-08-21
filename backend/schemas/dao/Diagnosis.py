from schemas.dao.Common import BaseRepository

from schemas.db.Diagnosis import Diagnosis


class DiagnosisRepository(BaseRepository):
    model = Diagnosis