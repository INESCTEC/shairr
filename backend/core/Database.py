import logging
import os
from contextlib import contextmanager

import sqlalchemy
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from core.Config import config

# Find backend directory (where this file is located)
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(backend_dir)

# Extract the directory path from the database URL and ensure it exists
if config.db_path.startswith("sqlite:///"):
    db_file_path = config.db_path[10:]
    db_directory = os.path.dirname(db_file_path)
    
    if db_directory:
        parent_dir = os.path.dirname(db_directory)
        if parent_dir and not os.path.exists(parent_dir):
            os.makedirs(parent_dir, exist_ok=True)
        os.makedirs(db_directory, exist_ok=True)

SQLALCHEMY_DATABASE_URL = config.db_path

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

DeclarativeBase = declarative_base()

logger = logging.getLogger(__name__)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()

@contextmanager
def SessionManager():
    db = SessionLocal()
    try:
        yield db
    except sqlalchemy.exc.IntegrityError as e:
        logger.error(f"Database integrity error, performing rollback. Exception details: {e}")
        integrity_errors = db.execute(sqlalchemy.text("PRAGMA foreign_key_check;"))
        print(integrity_errors.all())
        db.rollback()
        raise
    except Exception as e:
        logger.error(f"Database operation failed, performing rollback. Exception details: {e}")
        db.rollback()
        raise
    finally:
        db.close()