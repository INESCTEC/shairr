from sqlalchemy import Column, Integer, String, ForeignKey, event
from sqlalchemy.orm import relationship

import core.Seeding
from core import Database
from schemas.db.Ontology import Ontology


# https://docs.airr-community.org/en/latest/datarep/metadata.html#diagnosis-fields

class Diagnosis(Database.DeclarativeBase):
    __tablename__ = ("diagnosis")

    id = Column(Integer, primary_key=True, index=True)

    #diagnosis_timepoint = Column(DateTime(timezone=True), nullable=True)
    disease_diagnosis = Column(Ontology, nullable=True) # Should be an ontology (ID Label)
    disease_stage = Column(String, nullable=True)
    immunogen = Column(String, nullable=True)

    id_subject = Column(Integer, ForeignKey('subject.id', ondelete="CASCADE"), nullable=True)
    subject = relationship("Subject", back_populates="diagnosis",  lazy='subquery')
