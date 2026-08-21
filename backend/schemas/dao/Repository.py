from schemas.dao.Common import BaseRepository
from schemas.db.Repository import Repository


class RepositoryRepository(BaseRepository):
    model = Repository