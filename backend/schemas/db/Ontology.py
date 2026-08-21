import json
from typing import Any

from pydantic_core import core_schema
from sqlalchemy import TypeDecorator, String

class Ontology(TypeDecorator):
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, dict):
            return json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return None
        return value

    def coerce_compared_value(self, op, value):
        return self.impl

    @classmethod
    def __get_pydantic_core_schema__(
        cls, 
        source_type: Any, 
        handler: Any
    ) -> core_schema.CoreSchema:
        """
        Ontology should validate as a dictionary
        with string keys and any values (matching JSON structure)
        """
        return core_schema.dict_schema(
            keys_schema=core_schema.str_schema(),
            values_schema=core_schema.any_schema()
        )