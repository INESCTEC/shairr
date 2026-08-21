import io
from dataclasses import dataclass
from typing import Iterator, Union

import requests

from core.Files import buffer_length


class InMemoryResponse:
    def __init__(self, content: bytes):
        self._buffer = io.BytesIO(content)

    def iter_content(self, chunk_size: int = buffer_length) -> Iterator[bytes]:
        while True:
            chunk = self._buffer.read(chunk_size)
            if not chunk:
                break
            yield chunk

    def close(self) -> None:
        self._buffer.close()

@dataclass(frozen=True)
class DownloadStream:
    """
    Wrapper for tuple[str, Iterator[bytes]], which return a filename and a requests iterator.
    Handles connection closing automatically
    """
    filename: str
    response: Union[requests.Response, InMemoryResponse]

    def iter_bytes(self, chunk_size: int = buffer_length) -> Iterator[bytes]:
        yield from self.response.iter_content(chunk_size=chunk_size)

    def close(self) -> None:
        self.response.close()

    def __iter__(self) -> Iterator[bytes]:
        try:
            yield from self.response.iter_content(chunk_size=buffer_length)
        finally:
            self.response.close()

    def __enter__(self) -> "DownloadStream":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()