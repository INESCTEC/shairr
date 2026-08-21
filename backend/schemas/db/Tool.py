from sqlalchemy import Column, Integer, String, Boolean, Text
from sqlalchemy.orm import relationship

from core import Database


class Tool(Database.DeclarativeBase):
    __tablename__ = "tool"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    install_script = Column(String)
    installed = Column(Boolean)
    environment_variables = Column(String)
    active = Column(Boolean, nullable=False, default=True)
    properties = Column(Text, nullable=True, default=None)

    actions = relationship("Action", back_populates="tool", lazy='subquery')