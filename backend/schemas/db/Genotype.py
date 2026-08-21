from sqlalchemy import Column, Integer, ForeignKey, String, event, Enum
from sqlalchemy.orm import relationship
from schemas.db.MhcClass import MhcClass

import core.Seeding
from core import Database


class Genotype(Database.DeclarativeBase):
    __tablename__ = "genotype"

    __table_args__ = {
        "comment": "MHC Genotype List (subject) values"
    }

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    mhc_class = Column(Enum(MhcClass), nullable=False)
    id_subject = Column(Integer, ForeignKey("subject.id"), nullable=True)

    subject = relationship("Subject", back_populates="genotypes")
