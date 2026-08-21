from sqlalchemy import Column, Integer, ForeignKey, event
from sqlalchemy.orm import relationship

import core.Seeding
from core import Database


class Read(Database.DeclarativeBase):
    __tablename__ = "read"

    __table_args__ = {
        "comment": "FASTQs"
    }

    id = Column(Integer, primary_key=True, index=True)
    id_dataset = Column(Integer, ForeignKey("dataset.id", ondelete="CASCADE"))
    id_sample = Column(Integer, ForeignKey("sample.id", ondelete="CASCADE"), nullable=True)

    dataset = relationship("Dataset", back_populates="reads", lazy="subquery")
    sample = relationship("Sample", back_populates="reads", lazy="subquery")
    annotations = relationship("Annotation", back_populates="reads", cascade="all, delete", lazy="subquery")
