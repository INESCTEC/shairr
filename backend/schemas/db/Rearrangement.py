from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime, func, Enum, JSON
from sqlalchemy.orm import relationship

from core import Database
from schemas.db.DataType import DataType


class Rearrangement(Database.DeclarativeBase):
    __tablename__ = "rearrangement"

    id = Column(Integer, primary_key=True, index=True)
    id_user = Column(Integer, ForeignKey('user.id', ondelete="CASCADE"), nullable=False)
    id_task = Column(Integer, ForeignKey('task.id', ondelete="CASCADE"), nullable=True)
    id_sample = Column(Integer, ForeignKey('sample.id', ondelete="CASCADE"), nullable=True)

    filename = Column(String)
    filepath = Column(String)
    filesize = Column(Float)
    time_created = Column(DateTime(timezone=True), server_default=func.now())
    type = Column(Enum(DataType), nullable=False)
    properties = Column(JSON)

    user = relationship("User", back_populates="rearrangements", passive_deletes=True)
    task = relationship("Task", back_populates="rearrangements", passive_deletes=True)
    sample = relationship("Sample", back_populates="rearrangements", passive_deletes=True)