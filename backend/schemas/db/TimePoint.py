from sqlalchemy import Column, Integer, String, ForeignKey, Float, event
from sqlalchemy.orm import relationship

import core.Seeding
from core import Database


class TimePoint(Database.DeclarativeBase):
    __tablename__ = "time_point"

    id = Column(Integer, primary_key=True, index=True)
    id_subject = Column(Integer, ForeignKey("subject.id", ondelete="CASCADE"))
    id_relative_time_point = Column(Float, nullable=True)
    units_of_measurement = Column(String)
    time_point = Column(Float, comment="Time period for a disease state sample (e.g.  \"0 days\",  \"15 days\"")
    description = Column(String, comment="Textual description of the timepoint (e.g.  \"Pre-vax\",  \"Post-vax\"")

    subject = relationship("Subject", back_populates="time_points")
    sample = relationship("Sample", back_populates="time_points")
