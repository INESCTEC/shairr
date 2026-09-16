import hashlib
import logging
import os
import re
import shutil
import typing
from datetime import datetime
from pathlib import PurePosixPath
from typing import BinaryIO

from fastapi.encoders import jsonable_encoder

from core.Config import config
from services.Services import Services

logger = logging.getLogger(__name__)

is_windows = os.name == 'nt'
buffer_length = 1024 * 1024 if is_windows else 64 * 1024


class Files:
    @staticmethod
    def stream_file_upload(file_source: typing.BinaryIO, file_destination: typing.BinaryIO) -> str:
        """
        Streams 'file_source' into 'file_destination' in chunks.
        Used for file upload in order to avoid loading whole files into memory.
        Heavily Based on shutil's copyfileobj implementation.
        Returns file's sha256 hash when done
        """
        fsrc_read = file_source.read
        fdst_write = file_destination.write
        sha256 = hashlib.sha256()

        while True:
            buf = fsrc_read(buffer_length)

            if not buf:
                break

            sha256.update(buf)

            fdst_write(buf)

        return sha256.hexdigest()

    @staticmethod
    def stream_file_download(yielded_chunk: typing.Iterator[bytes], file_destination: typing.BinaryIO) -> str:
        """
        Streams downloaded 'yielded_chunk' into 'file_destination'
        Used for file downloads in order to avoid loading whole files into memory.
        Heavily Based on shutil's copyfileobj implementation.
        Returns file's sha256 hash when done
        """
        fdst_write = file_destination.write
        sha256 = hashlib.sha256()

        for chunk in yielded_chunk:
            if not chunk:
                continue

            sha256.update(chunk)
            fdst_write(chunk)

        return sha256.hexdigest()

    @staticmethod
    def get_hash(filepath: str) -> str:
        with open(filepath, 'rb') as f:
            sha256 = hashlib.sha256()

            while True:
                buf = f.read(buffer_length)

                if not buf:
                    break

                sha256.update(buf)

        return sha256.hexdigest()

    @staticmethod
    def coalesce_directory(directory: str) -> None:
        if not os.path.exists(directory):
            os.makedirs(directory)

    @staticmethod
    def format_upload_destination(id_user: int, filename: str) -> str:
        """
        Format the destination path for an uploaded file.
        """
        destination: str = os.path.join(config.uploads_path, str(id_user))

        Files.coalesce_directory(destination)

        return os.path.join(destination, filename)

    @staticmethod
    def get_download_destination(id_user: int) -> str:
        destination: str = os.path.join(config.downloads_path, str(id_user))

        Files.coalesce_directory(destination)

        return destination

    @staticmethod
    def format_download_destination(id_user: int, filename: str) -> str:
        """
        Format the destination path for a downloaded file.
        """
        destination = Files.get_download_destination(id_user)

        return os.path.join(destination, filename)

    @staticmethod
    def format_generator_destination(id_user: int) -> str:
        """
        Format the destination path for an uploaded file.
        """
        destination: str = os.path.join(config.uploads_path, str(id_user))

        Files.coalesce_directory(destination)

        return os.path.join(destination, Files.format_generator_filename())

    @staticmethod
    def store_dataset(file_source: str, filehash: str) -> str:
        """
        Moves file from file_source to a permanent directory in datasets
        Naming based on the formula:
        data/datasets/[first 3 characters of filehash]/[actual file renamed to filehash]
        Returns full resulting filepath
        """
        dest_path = Files.format_dataset_destination(filehash)

        logger.debug(f"Attempting to store {file_source} into {dest_path}")

        moved_dest = shutil.move(file_source, dest_path)

        logger.debug(f"Move operation resulted in: {moved_dest}")

        return dest_path

    @staticmethod
    def format_dataset_destination(filehash: str) -> str:
        """
        Format the destination path for dataset files.
        """
        dataset_dir = os.path.join(config.dataset_path, filehash[:3])

        Files.coalesce_directory(dataset_dir)

        return os.path.join(dataset_dir, filehash)

    @staticmethod
    def format_airr_filename(id_repertoire: str) -> str:
        timestamp = (datetime.now() - datetime(1970, 1, 1)).total_seconds()
        return "airr-{0}-{1}.tsv".format(id_repertoire, int(timestamp))

    @staticmethod
    def format_generator_filename() -> str:
        timestamp = (datetime.now() - datetime(1970, 1, 1)).total_seconds()
        return f"generator-{int(timestamp)}.yaml"

    @staticmethod
    def get_file_contents(path: str) -> str:
        """
        Gets the contents of a text file, if it exists.

        :param str path: the location of the file.
        :rtype: ``str``
        """
        with open(path, "r") as f:
            return f.read()

    @staticmethod
    def get_file_raw(path: str, head: int) -> str:
        """
        Gets the first provided number of lines of a text file

        :param str path: the location of the file.
        :param int head: number of lines to read from the start of the file
        :rtype: ``str``
        """
        output: list[str] = []

        with open(path, "r") as f:
            if head:
                for _ in range(head):
                    try:
                        output.append(next(f))
                    except StopIteration:
                        break
            else:
                for line in f:
                    output.append(line)

        return "".join(output)

    @staticmethod
    def format_action_scripts_path(script_filename: str) -> str:
        if script_filename is None:
            return None
        return os.path.join("scripts", script_filename)

    @staticmethod
    def create_update_script(script_filename: str, script: str) -> str:
        """
        Creates or updates the file containing a script.

        :param str script_filename: the script's desired file name
        :param str script: the string containing the actual script
        :rtype: ``str``
        """

        file_path = os.path.join("scripts", script_filename)
        with open(file_path, "w") as f:
            f.write(script)
        return file_path

    @staticmethod
    def format_action_output_path(id_workflow: str) -> str:
        destination: str = os.path.join(config.tasks_path, id_workflow)

        if not os.path.exists(destination):
            os.makedirs(destination)

        return destination

    @staticmethod
    def extract_sample_filename(sample_file_path: str) -> str:
        sample_file_path_normalized = sample_file_path.strip().rstrip("/")
        return PurePosixPath(sample_file_path_normalized).name

    @staticmethod
    def delete_dataset(filepath: str):
        os.remove(filepath)

    @staticmethod
    def delete_rearrangement(filepath: str):
        os.remove(filepath)

    @staticmethod
    def format_upload_destination_dataset(filename: str) -> str:
        """Format destination path for dataset uploads (no user isolation)."""
        destination: str = os.path.join(config.uploads_path, "dataset")
        Files.coalesce_directory(destination)
        return os.path.join(destination, filename)

    @staticmethod
    def format_download_destination_dataset(filename: str) -> str:
        """Format destination path for dataset downloads (no user isolation)."""
        destination: str = os.path.join(config.downloads_path, "dataset")
        Files.coalesce_directory(destination)
        return os.path.join(destination, filename)

    @staticmethod
    def remove_extensions(path: str) -> str:
        """
        Removes all extensions, leaving any 'internal' dots (e.g. '.downsampled').
        """
        base = os.path.basename(path)
        # Remove all trailing extensions like .fastq.gz (multi-part)
        while True:
            root, ext = os.path.splitext(base)
            if not ext:
                break
            base = root
        return base

    @staticmethod
    def extract_common_filename(file_list: list[str]) -> str:
        """
        Given a list of file names, returns the largest common part (not necessarily a strict
        left-to-right prefix) of the base names (i.e., with extensions removed), preserving
        separators where appropriate.

        Example:
        [
            "70-10_TP2_CD4_S56_R2_001.downsampled.fastq.gz",
            "70-10_TP2_CD4_S56_R1_001.downsampled.fastq.gz"
        ]
        -> "70-10_TP2_CD4_S56_001.downsampled"
        """
        if not file_list:
            return ""

        base_names = [Files.remove_extensions(f) for f in file_list]

        # Tokenize into alternating [alnum]+ and [non-alnum]+ so separators are explicit tokens
        def tokenize(s: str) -> list[str]:
            return re.findall(r'[A-Za-z0-9]+|[^A-Za-z0-9]+', s)

        token_lists = [tokenize(s) for s in base_names]
        if not token_lists:
            return ""

        # Iterate over positions up to the shortest token list length; keep tokens that match in all
        min_len = min(len(toks) for toks in token_lists)
        kept_tokens: list[str] = []
        for i in range(min_len):
            tok = token_lists[0][i]
            if all(toks[i] == tok for toks in token_lists):
                # Avoid piling up separators back-to-back
                if kept_tokens and not tok[0].isalnum() and not kept_tokens[-1][0].isalnum():
                    continue
                kept_tokens.append(tok)
            else:
                # If this position differs, skip it (drops things like R1 vs R2)
                # Do not break; later positions may match again (e.g., "_001.downsampled")
                continue

        # Clean up: remove leading/trailing separators and collapse duplicate separators
        # Remove leading non-alnum
        while kept_tokens and not kept_tokens[0][0].isalnum():
            kept_tokens.pop(0)
        # Remove trailing non-alnum
        while kept_tokens and not kept_tokens[-1][0].isalnum():
            kept_tokens.pop()

        # Collapse any accidental repeated separator runs (e.g., "__" + "_" -> "__")
        cleaned: list[str] = []
        for tok in kept_tokens:
            if cleaned and not tok[0].isalnum() and not cleaned[-1][0].isalnum():
                # Merge with previous separator token
                cleaned[-1] = cleaned[-1] + tok
            else:
                cleaned.append(tok)

        return "".join(cleaned)


class HashingTextWriter:
    """
    Minimal text stream for pandas.to_csv:
      - accepts text via write(str)
      - encodes to bytes
      - updates SHA256
      - forwards bytes to an underlying binary stream
    """
    def __init__(self, raw: BinaryIO, encoding: str = "utf-8"):
        self.raw = raw
        self.encoding = encoding
        self.hasher = hashlib.sha256()

    def write(self, s: str) -> int:
        b = s.encode(self.encoding)
        self.hasher.update(b)
        self.raw.write(b)
        # return number of characters written, like a normal text stream
        return len(s)

    def flush(self) -> None:
        self.raw.flush()

    def close(self) -> None:
        try:
            # flushing is enough; underlying file will be closed by its own context
            self.raw.flush()
        except Exception:
            pass