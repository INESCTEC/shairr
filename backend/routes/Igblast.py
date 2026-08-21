import asyncio
import contextlib
import logging
import os
import queue
import uuid
from logging import Handler, LogRecord
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, HTTPException, status
from fastapi.params import Depends
from starlette.responses import StreamingResponse

from core.Auth import OidcWorkflow
from core.Config import config
from core.Files import Files, HashingTextWriter
from schemas.dao.Annotation import AnnotationRepository
from schemas.dao.Dataset import DatasetRepository
from schemas.dao.Read import ReadRepository
from schemas.db import Dataset
from schemas.db.Read import Read
from schemas.json.Dataset import DatasetCreate, DatasetResponse
from services.IgBlastService import IgBlastService
from schemas.json.User import UserData
from schemas.dao.Igblast import IgblastLocus, IgblastDownloadOptions

router = APIRouter()

logger = logging.getLogger(__name__)

# --- A handler that forwards logs into a queue ---
class QueueLogHandler(Handler):
    def __init__(self, q: queue.Queue):
        super().__init__()
        self.q = q

    def emit(self, record: LogRecord):
        try:
            msg = self.format(record)
        except Exception:
            msg = record.getMessage()

        # Put a line
        self.q.put_nowait(msg)

def annotate_and_save(user: UserData, germline_sequences: str, tsv_filename: str):
    # usage:
    # annotate_j [-h] [--verbose] seq_file out_file
    return 

def output_ndm_and_save(user: UserData, ref_file: str, chain: bool, ndm_file: str):
    # usage:
    # make_igblast_ndm [-h] [--cdr_coords CDR_COORDS] ref_file chain ndm_file

    # We will probably need:
    # - receptor_utils.simple_bio_seq.read_fasta(infile: str)
    # - receptor_utils.simple_bio_seq.read_imgt_fasta(infile: str, species: str, chains=('IGHV', 'IGHD', 'IGHJ', 'CH'), functional_only: bool = False, include_orphon: bool = False)
    return

def download_germline_and_save(user: UserData, species: str, locus: IgblastLocus, download_option: IgblastDownloadOptions):
    # usage:
    # download_germline_set [-h] [-n NAME] [-v VERSION] [-f {AIRRC-JSON,SINGLE-FG,SINGLE-FU,MULTI-F,MULTI-IGBLAST}] [-u URL] [-p PREFIX] species locus
    pass

