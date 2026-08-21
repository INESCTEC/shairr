from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Query

from core import Database
from schemas.dao.Common import BaseRepository
from schemas.db.Task import Task
from schemas.db.TaskStatus import TaskStatus
from schemas.json.Task import TaskPatch


class TaskRepository(BaseRepository):
    model = Task

    @staticmethod
    def get_all_by_user(id_user: int, task_status: TaskStatus | None = None, id_pipeline_config: int = None) -> list[Task]:
        with Database.SessionManager() as db:
            query: Query = db.query(Task).where(
                Task.id_user == id_user
            )

            if task_status:
                query = query.where(Task.status == task_status)

            if id_pipeline_config:
                query = query.where(Task.id_pipeline_config == id_pipeline_config)

            return query.all()

    @staticmethod
    def get_by_user(id_user: int, id_task: int) -> Task:
        with Database.SessionManager() as db:
             return db.query(Task).outerjoin(
                Task.datasets
            ).where(
                Task.id_user == id_user,
                Task.id == id_task
            ).first()

    @staticmethod
    def count(id_user: int, task_status: TaskStatus | None = None) -> int:
        with Database.SessionManager() as db:
            query: Query = db.query(func.count(Task.id)).where(
                Task.id_user == id_user
            )

            if task_status:
                query = query.where(Task.status == task_status)

            return query.scalar()

    @staticmethod
    def update_by_user(id_user: int, id_task: int, task_patch: TaskPatch) -> Task:
        criterion = (Task.id_user == id_user, Task.id == id_task)
        return TaskRepository.update_by_criterion(criterion, task_patch.model_dump(exclude_unset=True))

    @staticmethod
    def set_finished(id_user: int, id_task: int, task_status: TaskStatus = TaskStatus.FINISHED):
        task_patch = TaskPatch(status=task_status, time_end=datetime.now(timezone.utc))
        TaskRepository.update_by_user(id_user, id_task, task_patch)

    @staticmethod
    def update_progress(task_id: int, inputs: dict):
        TaskRepository.update(task_id, {"inputs": inputs})
