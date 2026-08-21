from sqlalchemy.orm import Query

from core import Database
from core.Files import Files
from schemas.dao.Common import BaseRepository
from schemas.db.Tool import Tool


class ToolRepository(BaseRepository):
    model = Tool

    @staticmethod
    def get_by_name(tool_name: str) -> Tool | None:
        """Get a tool by its exact name"""
        with Database.SessionManager() as session:
            return session.query(Tool).filter(Tool.name.contains(tool_name)).first()

    @staticmethod
    def search_by_name(search_term: str, limit: int = 10, page: int = 1) -> list[Tool]:
        """Search tools by name (case-insensitive)"""
        with Database.SessionManager() as session:
            offset = (page - 1) * limit
            return session.query(Tool).filter(
                Tool.name.ilike(f'%{search_term}%')
            ).limit(limit).offset(offset).all()

    @staticmethod
    def set_installed(id: int, installed: bool = True) -> Tool:
        with Database.SessionManager() as db:
            query: Query = db.query(Tool).filter(Tool.id == id)

            query.update({"installed": installed})

            db.commit()

            return query.first()

    @staticmethod
    def add_install_script_file(tool: Tool) -> str:
        """
        Creates a file to store the installation script and stores that in the tool object.

        :param Tool tool: the tool object
        :rtype: str
        """
        script = tool.install_script
        script_name = f"{tool.name}-install.nf"
        file_path = Files.create_update_script(script_name, script)
        tool.install_script = script_name

        return file_path
