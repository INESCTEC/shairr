import logging
import os.path

from sqlalchemy import func
from sqlalchemy.orm import Query

from core import Database
from core.Files import Files
from schemas.dao.Common import BaseRepository
from schemas.db.DataType import DataType
from schemas.db.Rearrangement import Rearrangement
from schemas.json.Rearrangement import RearrangementCounts

logger = logging.getLogger(__name__)


class RearrangementRepository(BaseRepository):
    model = Rearrangement

    @staticmethod
    def get_by_user(id_user: int, id_rearrangement: int) -> Rearrangement:
        with Database.SessionManager() as db:
            query = db.query(Rearrangement).where(
                Rearrangement.id_user == id_user,
                Rearrangement.id == id_rearrangement
            )

            return query.first()

    @staticmethod
    def get_all_by_user(id_user: int, datatype: DataType = None) -> list[Rearrangement]:
        with Database.SessionManager() as db:
            query = db.query(Rearrangement).where(
                Rearrangement.id_user == id_user
            )

            if datatype:
                query = query.where(Rearrangement.type == datatype)

            return query.all()

    @staticmethod
    def get_abspath(id_user, id_rearrangement) -> str:
        rearrangement = RearrangementRepository.get_by_user(id_user, id_rearrangement)

        if not rearrangement:
            raise FileNotFoundError(f"Requested rearrangement with ID {id_rearrangement} does not exist")

        if not os.path.exists(rearrangement.filepath):
            raise FileNotFoundError(f"Rearrangement with ID {id_rearrangement} exists in the database but no physical reference was found in the filesystem")

        return os.path.abspath(rearrangement.filepath)

    @staticmethod
    def count(id_user: int) -> RearrangementCounts:
        with Database.SessionManager() as db:
            query: Query = db.query(func.count(Rearrangement.id)).where(
                Rearrangement.id_user == id_user,
                Rearrangement.type == DataType.ANTIGEN
            )

            antigen_count: int = query.scalar()

            query: Query = db.query(func.count(Rearrangement.id)).where(
                Rearrangement.id_user == id_user,
                Rearrangement.type == DataType.REPERTOIRE
            )

            sequence_count: int = query.scalar()

            return RearrangementCounts(antigen_count=antigen_count, sequence_count=sequence_count)

    @staticmethod
    def remove_by_user(id_user: int, id_rearrangement: int) -> bool:
        with Database.SessionManager() as db:
            rearrangements = db.query(Rearrangement).filter(
                Rearrangement.id_user == id_user,
                Rearrangement.id == id_rearrangement
            )

            if not rearrangements.first():
                return False

            rearrangements.delete(synchronize_session=False)

            db.commit()

            return True

    @staticmethod
    def delete_all_by_user(id_user: int) -> None:
        rearrangements: list[Rearrangement] = RearrangementRepository.get_all_by_user(id_user)

        for rearrangement in rearrangements:
            if rearrangement.filepath:
                try:
                    Files.delete_rearrangement(rearrangement.filepath)
                    logger.debug(f"Deleted rearrangement file: {rearrangement.filepath}")
                except Exception as exc:
                    logger.error(f"Failed to delete rearrangement file {rearrangement.filepath}: {str(exc)}")

            RearrangementRepository.remove_by_user(id_user, rearrangement.id)