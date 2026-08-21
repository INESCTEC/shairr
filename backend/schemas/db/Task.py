from sqlalchemy import Column, ForeignKey, Integer, String, Enum, DateTime, func, JSON
from sqlalchemy.orm import relationship

from core import Database
from schemas.db.TaskStatus import TaskStatus


class Task(Database.DeclarativeBase):
    __tablename__ = "task"

    __table_args__ = {
        'comment': 'Stores execution tasks'
    }

    id = Column(Integer, primary_key=True, index=True)
    id_process = Column(Integer)
    id_action = Column(Integer, ForeignKey('action.id', ondelete="CASCADE"), nullable=True)
    id_user = Column(Integer, ForeignKey('user.id', ondelete="CASCADE"))

    name = Column(String)
    time_start = Column(DateTime(timezone=True), server_default=func.now())
    time_end = Column(DateTime(timezone=True), nullable=True)
    status = Column(Enum(TaskStatus), nullable=False, default=TaskStatus.RUNNING)
    inputs = Column(JSON, nullable=False, default=dict)
    output_path = Column(String)

    action = relationship("Action", back_populates="tasks", lazy='subquery', passive_deletes=True)
    user = relationship("User", back_populates="tasks", lazy='subquery', passive_deletes=True)
    rearrangements = relationship("Rearrangement", back_populates="task")
    datasets = relationship("Dataset", back_populates="task", lazy='selectin')