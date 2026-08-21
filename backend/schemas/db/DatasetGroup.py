from sqlalchemy import Column, Integer, Float, String, DateTime, func, Boolean, event
from sqlalchemy.orm import relationship

import core.Seeding
from core import Database


class DatasetGroup(Database.DeclarativeBase):
    __tablename__ = "dataset_group"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)

    datasets = relationship("Dataset", back_populates="groups", cascade="all, delete", lazy="joined")