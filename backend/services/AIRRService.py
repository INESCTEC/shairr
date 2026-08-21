import hashlib
import logging
import typing
from typing import Optional

import requests
from fastapi import HTTPException, status

from core.Files import buffer_length, Files
from exceptions.AIRRException import AIRRException
from schemas.dao.Dataset import DatasetRepository
from schemas.dao.Task import TaskRepository
from schemas.db import Task
from schemas.db.DataType import DataType
from schemas.db.TaskStatus import TaskStatus
from schemas.json.Rearrangement import AIRRRearrangementCreate, RearrangementCreate

logger = logging.getLogger(__name__)

class AIRRService:
    @staticmethod
    def yield_rearragements(url: str, sample_id: Optional[str], repertoire_id: Optional[str],  auth_token: Optional[str]) -> tuple[Optional[int], typing.Iterator[bytes]]:
        """
        Get Rearrangements associated to a Repertoire
        Uses standard AIRR request filter
        """
        if bool(sample_id) == bool(repertoire_id):
            raise ValueError(
                "You must provide exactly one of: 'sample_id' or 'repertoire_id'."
            )

        if sample_id:
            field = "sample_id"
            value = sample_id
        else:
            field = "repertoire_id"
            value = repertoire_id

        body = {
            "filters": {
                "op": "=",
                "content": {
                    "field": field,
                    "value": value,
                },
            },
            "format": "tsv"
        }

        # Build headers, including Authorization if token is provided
        headers = {}

        if auth_token is not None:
            # If your API expects a raw token instead of Bearer, change this line accordingly
            headers["Authorization"] = f"Bearer {auth_token}"
            logger.debug("Authorization token has been provided")


        url = url + "/rearrangement"

        try:
            logger.debug(f"Starting /rearrangement download")

            logger.debug(body)

            tsv_request = requests.post(
                url,
                headers=headers or None,
                json=body,
                stream=True
            )

            tsv_request.raise_for_status()

            logger.debug(f"Server responded: {tsv_request}")
        except (requests.exceptions.RequestException, requests.exceptions.ConnectionError) as re:
            error_details = f"An error occurred while trying to contact specified AIRR repository. Error code: {re}"

            if hasattr(re, 'response') and hasattr(re.response, 'status_code'):
                error_details += f" AIRR server status code: {re.response.status_code}"

            logger.error(error_details)

            raise AIRRException(error_details)

        content_length = tsv_request.headers.get('Content-Length')
        total_bytes = int(content_length) if content_length else None
        return total_bytes, tsv_request.iter_content(buffer_length)

    @staticmethod
    def download_rearrangements(id_user, airr_dataset: AIRRRearrangementCreate, task_id: int = None):
        logger.debug(f"Attempting download on {airr_dataset.repository_url}")

        file_identifier = airr_dataset.external_id_sample if airr_dataset.external_id_sample else airr_dataset.external_id_repertoire

        filename = Files.format_airr_filename(file_identifier)
        download_filepath = Files.format_download_destination(id_user, airr_dataset.id_workspace, filename)

        logger.debug(f"Contents will be streamed to {download_filepath}")

        try:
            total_bytes, yielded_rearrangements = AIRRService.yield_rearragements(
                airr_dataset.repository_url,
                airr_dataset.external_id_sample,
                airr_dataset.external_id_repertoire,
                airr_dataset.auth_token
            )
        except AIRRException as e:
            if task_id:
                TaskRepository.set_finished(id_user, task_id, TaskStatus.ERROR)
                logger.error(f"AIRR download failed for task {task_id}: {e}")
                return
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

        filesize: int = 0
        bytes_downloaded: int = 0
        last_update_at: int = 0
        update_interval: int = buffer_length * 8
        sha256 = hashlib.sha256()

        with open(download_filepath, 'wb') as f:
            for chunk in yielded_rearrangements:
                if not chunk:
                    continue
                sha256.update(chunk)
                f.write(chunk)
                bytes_downloaded += len(chunk)

                if task_id and bytes_downloaded - last_update_at >= update_interval:
                    last_update_at = bytes_downloaded
                    inputs: dict = {"bytes": bytes_downloaded}
                    if total_bytes:
                        inputs["progress"] = min(99, int(bytes_downloaded / total_bytes * 100))
                    try:
                        TaskRepository.update_progress(task_id, inputs)
                    except Exception:
                        pass

            filehash = sha256.hexdigest()
            filesize = f.tell()

        logger.debug(f"Download completed for {airr_dataset.repository_url}")

        final_path = Files.store_dataset(download_filepath, filehash)

        logger.debug(f"Downloaded files moved to {final_path}")

        dataset = RearrangementCreate(
            id_user=id_user,
            id_sample=airr_dataset.id_sample,
            filename=filename,
            filepath=final_path,
            filesize=filesize,
            type=DataType.REPERTOIRE
        )

        result = DatasetRepository.create_from_pydantic(dataset)

        if task_id:
            TaskRepository.set_finished(id_user, task_id)

        return result

    def create_download_rearrangements_task(id_user, task: Task, airr_dataset: AIRRRearrangementCreate):
        AIRRService.download_rearrangements(id_user, airr_dataset)
