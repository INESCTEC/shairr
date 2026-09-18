import logging
import os.path
import uuid
import asyncio
import tempfile
import hashlib
from typing import Annotated
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status, Form, BackgroundTasks
from fastapi.params import Query
from fastapi.responses import FileResponse
from pydantic import WithJsonSchema
from starlette.responses import PlainTextResponse

from core.Auth import OidcWorkflow
from core.Files import Files
from schemas.dao.Annotation import AnnotationRepository
from schemas.dao.Dataset import DatasetRepository
from schemas.dao.DatasetGroup import DatasetGroupRepository
from schemas.dao.Read import ReadRepository
from schemas.db import Dataset
from schemas.json.Annotation import AnnotationResponse, AnnotationCreate
from schemas.json.Dataset import DatasetCreate, DatasetResponse
from schemas.json.DatasetGroup import DatasetGroupCreate, DatasetGroupResponse
from schemas.json.Read import ReadResponse, ReadCreate
from schemas.json.User import UserData

from routes.UploadWebsocket import (
    update_upload_progress, 
    init_upload_session, 
    complete_upload_session,
    fail_upload_session
)

router = APIRouter()
logger = logging.getLogger(__name__)

BinaryUploadFile = Annotated[
    UploadFile,
    WithJsonSchema({"type": "string", "format": "binary"})
]

def create_file_not_found_response(dataset: Dataset):
    logger.error(f"Physical file at {dataset.filepath} could not be found on the filesystem.")
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Could not find physical file associated with dataset.")

import asyncio
import hashlib
import os

from pathlib import Path


async def process_temp_file(
    temp_path: str,
    filename: str,
    annotated: bool,
    session_id: str,
    file_index: int,
    total_files: int,
    processed_size_so_far: int,
    total_size: int
):
    file_size = os.path.getsize(temp_path)
    upload_path = Files.format_upload_destination_dataset(filename=filename)

    bytes_copied = 0
    chunk_size = 1024 * 1024 * 5

    hash_calculator = hashlib.sha256()

    try:
        with open(temp_path, "rb") as src, open(upload_path, "wb") as dst:
            while True:
                chunk = src.read(chunk_size)

                if not chunk:
                    break

                dst.write(chunk)
                hash_calculator.update(chunk)

                bytes_copied += len(chunk)

                file_progress = (
                    (bytes_copied / file_size) * 95
                    if file_size > 0
                    else 95
                )

                current_processed = processed_size_so_far + bytes_copied

                overall_progress = (
                    (current_processed / total_size) * 100
                    if total_size > 0
                    else 100
                )

                update_upload_progress(
                    session_id,
                    current_file=filename,
                    current_file_progress=file_progress,
                    overall_progress=overall_progress,
                    processed_size=current_processed
                )

                await asyncio.sleep(0.05)

        file_hash = hash_calculator.hexdigest()

        suffixes = Path(filename).suffixes

        if len(suffixes) >= 2 and suffixes[-1] == ".gz":
            extension = "".join(suffixes[-2:])
        else:
            extension = suffixes[-1] if suffixes else ""

        hashed_filename = f"{file_hash}{extension}"

        final_path = Files.store_dataset(upload_path, hashed_filename)

    except Exception:
        if os.path.exists(upload_path):
            os.remove(upload_path)

        raise

    line_count = 0

    try:
        with open(
            final_path,
            "r",
            encoding="utf-8",
            errors="ignore"
        ) as file_handle:
            line_count = sum(1 for _ in file_handle)
    except OSError:
        pass

    dataset_create = DatasetCreate(
        filename=filename,
        filepath=final_path,
        filesize=file_size,
        annotated=annotated,
        line_count=line_count
    )

    created_dataset = DatasetRepository.create_from_pydantic(
        dataset_create
    )

    if "fastq" in filename.lower():
        created_entry = ReadRepository.create_from_pydantic(
            ReadCreate(
                id_dataset=created_dataset.id,
                id_sample=None
            )
        )

        ReadResponse.model_validate(created_entry)

    elif "tsv" in filename.lower():
        created_entry = AnnotationRepository.create_from_pydantic(
            AnnotationCreate(
                id_dataset=created_dataset.id,
                id_sample=None,
                id_read=None
            )
        )

        AnnotationResponse.model_validate(created_entry)

    return file_size

async def process_all_files_from_temp(file_data_list: list, annotated: bool, 
                                      session_id: str, total_size: int):
    processed_size = 0
    
    try:
        for i, file_data in enumerate(file_data_list):
            file_size = file_data["size"]
            
            update_upload_progress(
                session_id,
                current_file=file_data["filename"],
                current_file_progress=0,
                processed_files=i,
                processed_size=processed_size,
                overall_progress=(processed_size / total_size) * 100
            )
            
            bytes_processed = await process_temp_file(
                file_data["temp_path"], 
                file_data["filename"], 
                annotated, 
                session_id, 
                i, 
                len(file_data_list), 
                processed_size, 
                total_size
            )
            
            processed_size += bytes_processed
            
            update_upload_progress(
                session_id,
                current_file_progress=100,
                processed_files=i + 1,
                processed_size=processed_size,
                overall_progress=(processed_size / total_size) * 100
            )
        
        complete_upload_session(session_id)
        
    except Exception as e:
        fail_upload_session(session_id, str(e))
        raise
    finally:
        for file_data in file_data_list:
            try:
                os.unlink(file_data["temp_path"])
            except:
                pass

@router.post("/dataset")
async def upload_datasets(
    user: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    files: Annotated[list[BinaryUploadFile], File(description="Physical file that represents the Dataset")],
    annotated: Annotated[bool, Form()],
    background_tasks: BackgroundTasks
) -> dict:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided")
    
    session_id = str(uuid.uuid4())
    init_upload_session(session_id, len(files), str(user.id))
    
    file_data_list = []
    total_size = 0
    
    for file in files:
        suffix = Path(file.filename).suffix

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            chunk_size = 1024 * 1024
            while chunk := await file.read(chunk_size):
                tmp.write(chunk)
            tmp_path = tmp.name
        
        file_size = os.path.getsize(tmp_path)
        total_size += file_size
        
        file_data_list.append({
            "filename": file.filename,
            "temp_path": tmp_path,
            "size": file_size
        })
        await file.close()
    
    update_upload_progress(
        session_id, 
        total_size=total_size, 
        processed_size=0,
        total_files=len(files)
    )
    
    background_tasks.add_task(
        process_all_files_from_temp,
        file_data_list=file_data_list,
        annotated=annotated,
        session_id=session_id,
        total_size=total_size
    )
    
    return {
        "session_id": session_id,
        "message": "Upload started",
        "total_files": len(files),
        "total_size": total_size,
        "websocket_url": f"/ws/upload-progress/{session_id}"
    }

@router.get("/dataset", description="Returns full list of files")
def list_datasets(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)]
) -> list[DatasetResponse]:
    datasets: list[Dataset] = DatasetRepository.get_all_datasets()
    return [DatasetResponse.model_validate(dataset) for dataset in datasets]

@router.get(
    "/dataset/{id_dataset}/raw",
    description="Get raw contents of a dataset file. Must be a supported text file.",
    response_class=PlainTextResponse
)
def get_dataset(
    user: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_dataset: int,
    head: int = Query(description="Return a specific number of lines from the file", default=None)
) -> str:
    dataset: Dataset = DatasetRepository.get(id_dataset)

    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    contents = ""

    try:
        contents = Files.get_file_raw(dataset.filepath, head)

    except UnicodeDecodeError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported file type. Could not "
                                                                                     "output contents directly.")
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Could not find file associated with dataset")

    except StopIteration:
        logger.debug(f"Requested {head} lines of raw output but file '{dataset.filename}' had less lines than {head}.")
        pass

    return contents

@router.get("/dataset/groups", description="Returns full list of dataset groups")
def list_dataset_groups(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)]
) -> list[DatasetGroupResponse]:
    return DatasetGroupRepository.get_all_dataset_groups()

@router.put("/dataset/{id_dataset}/{id_group}")
def add_dataset_to_group(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_dataset: int, id_group: int
) -> DatasetGroupResponse:
    dataset = DatasetRepository.get(id_dataset)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    dataset.id_group = id_group
    DatasetRepository.update(id_dataset, {"id_group": id_group})
    return DatasetGroupRepository.get(id_group)

@router.delete("/dataset/{id_dataset}/{id_group}")
def delete_dataset_from_group(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_dataset: int, id_group: int
) -> DatasetGroupResponse:
    dataset = DatasetRepository.get(id_dataset)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    dataset.id_group = None
    DatasetRepository.update(id_dataset, {"id_group": None})
    return DatasetGroupRepository.get(id_group)

@router.get("/dataset/{id_dataset}", description="Get file metadata")
def get_dataset_metadata(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_dataset: int,
) -> DatasetResponse:
    dataset: Dataset = DatasetRepository.get(id_dataset)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return DatasetResponse.model_validate(dataset)

@router.get(
    "/dataset/{id_dataset}/plain",
    description="Get raw contents of a file. Must be a supported text file.",
    response_class=PlainTextResponse
)
def get_plaintext(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_dataset: int,
    head: int = Query(description="Return a specific number of lines from the file", default=None)
) -> str:
    dataset: Dataset = DatasetRepository.get(id_dataset)

    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    contents = ""
    try:
        contents = Files.get_file_raw(dataset.filepath, head)
    except UnicodeDecodeError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported file type.")
    except FileNotFoundError:
        create_file_not_found_response(dataset)
    except StopIteration:
        logger.debug(f"Requested {head} lines but file had less.")
        pass
    return contents

@router.get("/dataset/{id_dataset}/download", description="Download file")
def download_dataset(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_dataset: int
) -> FileResponse:
    dataset: Dataset = DatasetRepository.get(id_dataset)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if not os.path.isfile(dataset.filepath):
        create_file_not_found_response(dataset)
    return FileResponse(path=dataset.filepath, filename=dataset.filename, media_type="application/octet-stream")

@router.delete(
    "/dataset/{id_dataset}",
    description="Delete existing file.",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_dataset(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_dataset: int
):
    dataset = DatasetRepository.get(id_dataset)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    try:
        logger.debug(f"Attempting to delete physical file at {dataset.filepath}")
        Files.delete_dataset(dataset.filepath)
    except FileNotFoundError:
        logger.warning(f"Attempted to delete non-existent physical file {dataset.filepath}")
        pass
    
    if not DatasetRepository.remove(id_dataset):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)