from sqlalchemy import Column, Integer, String, JSON
from sqlalchemy.orm import relationship

from core import Database


class User(Database.DeclarativeBase):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True)
    id_keycloak = Column(String, unique=True)
    properties = Column(JSON, nullable=True, server_default=None)

    tasks = relationship("Task", back_populates="user", lazy='subquery')
    rearrangements = relationship("Rearrangement", back_populates="user")
