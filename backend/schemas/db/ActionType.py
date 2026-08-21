from enum import Enum


class ActionType(Enum):
    GENERATOR = 1
    PREDICTION = 2
    SIMULATION = 3
    PREPROCESSING = 4
    STATISTICS = 5