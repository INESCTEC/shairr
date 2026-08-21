from sqlalchemy import Column, Integer, String, ForeignKey, Enum
from sqlalchemy.orm import relationship

from core import Database
from schemas.db.ActionType import ActionType


class Action(Database.DeclarativeBase):
    __tablename__ = "action"
    __table_args__ = {
        'comment': 'Defines a specific action or feature that a software "Tool" can execute.'
    }

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    name_friendly = Column(String, nullable=True)
    description = Column(String, nullable=True)
    codename = Column(String, unique=True)
    script = Column(String)

    id_tool = Column(Integer, ForeignKey('tool.id', ondelete="CASCADE"))
    tool = relationship("Tool", back_populates="actions", lazy='subquery', passive_deletes=True)

    type = Column(Enum(ActionType))
    
    tasks = relationship("Task", back_populates="action", lazy='subquery')