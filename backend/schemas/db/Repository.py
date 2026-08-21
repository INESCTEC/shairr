from sqlalchemy import Column, Integer, String, event

import core.Seeding
from core import Database


class Repository(Database.DeclarativeBase):
    __tablename__ = "repository"

    __table_args__ = {
        "comment": "FASTQs"
    }

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
