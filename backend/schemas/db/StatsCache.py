from sqlalchemy import Column, Integer, ForeignKey, Enum
from sqlalchemy.orm import relationship

from core import Database
from schemas.db.StatsType import StatsType


class StatsCache(Database.DeclarativeBase):
    __tablename__ = "stats_cache"

    id = Column(Integer, primary_key=True, index=True)
    id_input_dataset = Column(Integer, ForeignKey('dataset.id', ondelete="CASCADE"))
    type = Column(Enum(StatsType), nullable=False)
    id_result_dataset = Column(Integer, ForeignKey('dataset.id', ondelete="CASCADE"))
    
    input_dataset = relationship("Dataset", foreign_keys=[id_input_dataset])
    result_dataset = relationship("Dataset", foreign_keys=[id_result_dataset])

    #id_workspace = Column(Integer, ForeignKey('workspace.id', ondelete="CASCADE"))
    #workspace = relationship("Workspace", back_populates="datasets", passive_deletes=True)

    #id_task = Column(Integer, ForeignKey('task.id', ondelete="CASCADE"))
    #task = relationship("Task", back_populates="datasets", passive_deletes=True)

    #id_repertoire = Column(Integer, ForeignKey('repertoire.id', ondelete="CASCADE"))
    #repertoire = relationship("Repertoire", back_populates="rearrangements", passive_deletes=True)