from sqlalchemy import Column, Integer, PickleType, String, Boolean, ForeignKey, event
from sqlalchemy.orm import relationship

import core.Seeding
from core import Database
from schemas.db.Ontology import Ontology

class Subject(Database.DeclarativeBase):
    __tablename__ = "subject"

    id = Column(Integer, primary_key=True, index=True)
    id_study = Column(Integer, ForeignKey("study.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(String, unique=True, comment="Unique identifier for the subject")
    synthetic = Column(Boolean, comment="Indicating whether the subject is synthetic")
    species = Column(Ontology)

    diagnosis = relationship("Diagnosis", back_populates="subject", cascade="all, delete-orphan", lazy="subquery")
    time_points = relationship("TimePoint", back_populates="subject", cascade="all, delete-orphan", lazy="subquery")
    samples = relationship("Sample", back_populates="subject", cascade="all, delete-orphan", lazy="subquery")
    study = relationship("Study", back_populates="subject")
    genotypes = relationship("Genotype", back_populates="subject", cascade="all, delete-orphan", lazy="subquery")