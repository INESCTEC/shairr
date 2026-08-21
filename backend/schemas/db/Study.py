from sqlalchemy import Column, Integer, String, Boolean, event
from sqlalchemy.orm import relationship

import core.Seeding
from core import Database


class Study(Database.DeclarativeBase):
    __tablename__ = "study"

    id = Column(Integer, primary_key=True, index=True)

    study_id = Column(String, unique=True, comment="Identifier for the study")
    study_title = Column(String, comment="Title of the study")
    study_description = Column(String, comment="Detailed description of the study")
    contributors = Column(String, comment="List of contributors to the study")
    public = Column(Boolean, default=False, comment="Whether the study is publicly available")
    stats = Column(Boolean, default=False, comment="Whether the study is selected for statistics.")

    subject = relationship("Subject", back_populates="study", cascade="all, delete")
    samples = relationship("Sample", back_populates="study", cascade="all, delete")