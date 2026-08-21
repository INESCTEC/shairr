from sqlalchemy import Column, Integer, String, ForeignKey, event, Enum
from sqlalchemy.orm import relationship

import core.Seeding
from core import Database
from schemas.db.Ontology import Ontology
from schemas.db.SequencingType import SequencingType


class Sample(Database.DeclarativeBase):
    __tablename__ = "sample"

    id = Column(Integer, primary_key=True, index=True)
    id_subject = Column(Integer, ForeignKey("subject.id", ondelete="CASCADE"))
    id_study = Column(Integer, ForeignKey("study.id", ondelete="CASCADE"))
    id_timepoint = Column(Integer, ForeignKey("time_point.id", ondelete="CASCADE"), nullable=True)

    sample_id = Column(String, nullable=False)
    sample_type = Column(String, nullable=True)
    tissue = Column(Ontology, nullable=True)
    cell_subset = Column(Ontology, nullable=True)
    cell_phenotype = Column(String, nullable=True)
    sequencing_type = Column(Enum(SequencingType), nullable=True)

    subject = relationship("Subject", back_populates="samples")
    study = relationship("Study", back_populates="samples")
    time_points = relationship("TimePoint", back_populates="sample", cascade="all, delete", lazy="subquery")
    reads = relationship("Read", back_populates="sample", cascade="all, delete", lazy="subquery")
    annotations = relationship("Annotation", back_populates="sample", cascade="all, delete", lazy="subquery")
    rearrangements = relationship("Rearrangement", back_populates="sample")