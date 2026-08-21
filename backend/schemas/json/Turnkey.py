from pydantic import BaseModel


class RearragementRequest(BaseModel):
    datasets: list[int]