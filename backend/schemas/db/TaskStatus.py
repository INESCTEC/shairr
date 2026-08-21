from enum import Enum


class TaskStatus(Enum):
    RUNNING = 'RUNNING'
    ERROR = 'ERROR'
    FINISHED = 'FINISHED'
    KILLED = 'KILLED'