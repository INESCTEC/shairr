# In your model file
from enum import Enum

class MhcClass(Enum):
    CLASS_I = 'CLASS_I'
    CLASS_II = 'CLASS_II'
    
    # Add a class method to handle 'I' values
    @classmethod
    def from_string(cls, value):
        if value == 'I':
            return cls.CLASS_I
        elif value == 'II':
            return cls.CLASS_II
        return cls(value)
    
    # Or override the _missing_ method
    @classmethod
    def _missing_(cls, value):
        if value == 'I':
            return cls.CLASS_I
        elif value == 'II':
            return cls.CLASS_II
        return super()._missing_(value)