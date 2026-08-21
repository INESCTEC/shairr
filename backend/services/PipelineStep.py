from sqlalchemy import Column, Integer, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship

from core import Database


class PipelineStep(Database.DeclarativeBase):
    __tablename__ = "pipeline_step"
    __table_args__ = {
        'comment': 'Defines an action step of a processing pipeline.'
    }

    id = Column(Integer, primary_key=True, index=True)

    id_pipeline = Column(Integer, ForeignKey('pipeline.id'))
    pipeline = relationship("Pipeline", back_populates="steps", lazy='subquery')

    id_action =  Column(Integer, ForeignKey('action.id', ondelete="CASCADE"))
    action = relationship("Action", back_populates="pipeline_steps", lazy='subquery', passive_deletes=True)

    id_next_step = Column(Integer, ForeignKey('pipeline_step.id', ondelete="SET NULL"), nullable=True)
    next_step = relationship('PipelineStep', remote_side='PipelineStep.id', foreign_keys=[id_next_step])

    task = relationship("Task", back_populates="pipeline_step", lazy='subquery')

    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)

    properties = Column(JSON, nullable=True)
