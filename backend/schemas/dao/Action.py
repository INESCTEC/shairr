from typing import List

from core import Database
from core.Files import Files
from schemas.dao.Common import BaseRepository
from schemas.db.Action import Action

class ActionRepository(BaseRepository):
    model = Action

    @staticmethod
    def get_by_codename(codename: str) -> Action:
        with Database.SessionManager() as db:
            return db.query(Action).join(Action.tool).where(
                Action.codename == codename
            ).first()
