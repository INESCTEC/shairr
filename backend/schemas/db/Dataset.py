from sqlalchemy import Column, Integer, Float, String, DateTime, func, Boolean, event, ForeignKey
from sqlalchemy.orm import relationship

import core.Seeding
from core import Database


class Dataset(Database.DeclarativeBase):
    __tablename__ = "dataset"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    filepath = Column(String)
    filesize = Column(Float)
    line_count = Column(Integer)
    id_task = Column(Integer, ForeignKey('task.id', ondelete="SET NULL"), nullable=True)
    time_created = Column(DateTime(timezone=True), server_default=func.now())
    annotated = Column(Boolean)
    id_group = Column(Integer, ForeignKey("dataset_group.id"), nullable=True)

    reads = relationship("Read", back_populates="dataset", cascade="all, delete", lazy="subquery")
    groups = relationship("DatasetGroup", back_populates="datasets", cascade="all, delete", lazy="subquery")
    annotations = relationship("Annotation", back_populates="dataset", cascade="all, delete", lazy="subquery")
    task = relationship("Task", back_populates="datasets")
