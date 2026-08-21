from sqlalchemy import Column, Integer, ForeignKey, event
from sqlalchemy.orm import relationship

import core.Seeding
from core import Database


class Annotation(Database.DeclarativeBase):
    __tablename__ = "annotation"

    __table_args__ = {
        "comment": "TSVs"
    }

    id = Column(Integer, primary_key=True, index=True)

    id_sample = Column(Integer, ForeignKey("sample.id", ondelete="CASCADE"), nullable=True)
    id_read = Column(Integer, ForeignKey("read.id", ondelete="CASCADE"), nullable=True)
    id_dataset = Column(Integer, ForeignKey("dataset.id", ondelete="CASCADE"), nullable=False)

    sample = relationship("Sample", back_populates="annotations", lazy="subquery")
    reads = relationship("Read", back_populates="annotations", lazy="subquery")
    dataset = relationship("Dataset", back_populates="annotations", lazy="subquery")
