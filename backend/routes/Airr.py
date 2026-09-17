import logging
import os
from io import StringIO
from typing import Annotated, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, status
from fastapi.params import Depends
from starlette.responses import StreamingResponse

from core.Auth import OidcWorkflow
from core.Config import config
from core.Files import Files
from schemas.dao.Annotation import AnnotationRepository
from schemas.dao.Dataset import DatasetRepository
from schemas.dao.Sample import SampleRepository
from schemas.dao.Study import StudyRepository
from schemas.dao.Subject import SubjectRepository
from schemas.dao.TimePoint import TimePointRepository
from schemas.json.Sample import SampleBase
from schemas.json.Study import StudyBase
from schemas.json.Subject import SubjectBase
from schemas.json.User import UserData
from schemas.json.airr.AirrFilter import AirrQueryModel
from schemas.json.airr.Repertoire import AirrRepertoire, AirrRepertoireResponse

from services.AirrFilterService import filter_annotations_by_query

router = APIRouter()

logger = logging.getLogger(__name__)

def get_repertoires(
    user: Annotated[Optional[UserData], Depends(OidcWorkflow.get_optional_userinfo)]
) -> AirrRepertoireResponse:
    if user is not None:
        logger.info("Authenticated request to /repertoire")
        studies = StudyRepository.get_all()
    else:
        logger.info("Anonymous request to /repertoire")

        studies = [study for study in StudyRepository.get_all() if study.public]

    logger.debug(f"Found {len(studies)} studies")

    subjects: list[SubjectBase] = []

    for study in studies:
        study_subjects = SubjectRepository.get_by_study_id(study.id)

        logger.debug(f"Study {study.study_id} (id={study.id}) has {len(study_subjects)} subjects")

        subjects.extend(study_subjects)

    logger.info(
        f"Total subjects across accessible studies: {len(subjects)}"
    )

    if not subjects:
        logger.warning("No subjects found for accessible studies")

        return AirrRepertoireResponse.model_validate(
            {
                "Repertoire": []
            }
        )

    airr_repertoires: list[AirrRepertoire] = []

    for subject_db in subjects:
        subject = SubjectBase.from_db_model(subject_db)

        logger.debug(
            f"Processing subject {subject.subject_id} "
            f"(id={subject_db.id})"
        )

        logger.debug(f"Acquired subject dict: {subject}")

        study_db = StudyRepository.get(subject.id_study)

        if not study_db:
            logger.warning(
                f"No study found for subject study id {subject.id_study}"
            )
            continue

        study = StudyBase.model_validate(study_db).as_airr()

        if hasattr(subject, "diagnosis") and subject.diagnosis:
            subject.diagnosis = [
                diagnosis.as_airr()
                for diagnosis in subject.diagnosis
            ]

        timepoints = TimePointRepository.get_by_subject(subject_db.id)

        logger.debug(
            f"Subject has {len(timepoints)} timepoints"
        )

        samples_db = SampleRepository.get_by_subject(subject_db.id)

        logger.debug(f"Subject has {len(samples_db)} samples")

        samples = []

        for sample_db in samples_db:
            airr_sample = SampleBase.model_validate(sample_db).as_airr()

            timepoint = next(
                (point for point in timepoints
                    if sample_db.id_timepoint and point.id == sample_db.id_timepoint
                ),
                None,
            )

            if timepoint:
                airr_sample.collection_time_point_relative = (f"{timepoint.time_point} {timepoint.units_of_measurement}")

                airr_sample.disease_state_sample = (timepoint.description)

            samples.append(airr_sample)

        repertoire_id = (f"{study.study_id}{config.repertoire_separator}{subject.subject_id}")

        logger.debug(f"Adding repertoire: {repertoire_id}")

        airr_repertoires.append(
            AirrRepertoire.model_validate(
                {
                    "repertoire_id": repertoire_id,
                    "repertoire_name": subject.subject_id,
                    "subject": subject.as_airr(),
                    "sample": samples,
                    "study": study,
                    "data_processing": [],
                }
            )
        )

    logger.info(f"Total repertoires found: {len(airr_repertoires)}")

    return AirrRepertoireResponse.model_validate(
        {
            "Repertoire": airr_repertoires
        }
    )

router.get("/repertoire")(get_repertoires)
router.post("/repertoire")(get_repertoires)


def get_repertoire_by_id(
    repertoire_id: str,
    user: Annotated[Optional[UserData], Depends(OidcWorkflow.get_optional_userinfo)]
) -> AirrRepertoireResponse:
    try:
        study_id, subject_id = repertoire_id.rsplit(config.repertoire_separator,1)
    except ValueError:
        raise HTTPException(status_code=400, detail=(f"Invalid repertoire_id format. Expected format: study_id{config.repertoire_separator}subject_id"))

    study_db = StudyRepository.get_by_study_id(study_id)

    if not study_db:
        raise HTTPException(status_code=404, detail=f"Study {study_id} not found")

    # Anonymous users can only access public studies
    if user is None and not study_db.public:
        raise HTTPException(
            status_code=403,
            detail=f"Study {study_id} is not publicly available"
        )

    all_subjects = SubjectRepository.get_all()

    subject_db = next(
        (subject for subject in all_subjects
            if subject.subject_id == subject_id and subject.id_study == study_db.id
        ),
        None
    )

    if not subject_db:
        raise HTTPException(
            status_code=404,
            detail=f"Subject {subject_id} not found in study {study_id}"
        )

    subject = SubjectBase.from_db_model(subject_db)
    study = StudyBase.model_validate(study_db).as_airr()

    if "diagnosis" in subject:
        subject.diagnosis = [diagnosis.as_airr() for diagnosis in subject.diagnosis]

    timepoints = TimePointRepository.get_by_subject(subject_db.id)
    samples_db = SampleRepository.get_by_subject(subject_db.id)
    samples = []

    for sample in samples_db:
        airr_sample = SampleBase.model_validate(sample).as_airr()

        timepoint = next(
            (point for point in timepoints
                if sample.id_timepoint and point.id == sample.id_timepoint
            ),
            None
        )

        if timepoint:
            airr_sample.collection_time_point_relative = (f"{timepoint.time_point}  {timepoint.units_of_measurement}")
            airr_sample.disease_state_sample = (timepoint.description)

        samples.append(airr_sample)

    airr_repertoire = AirrRepertoire.model_validate(
        {
            "repertoire_id": repertoire_id,
            "repertoire_name": subject.subject_id,
            "subject": subject.as_airr(),
            "sample": samples,
            "study": study,
            "data_processing": [],
        }
    )

    return AirrRepertoireResponse.model_validate({
        "Repertoire": [airr_repertoire]
    })

router.get("/repertoire/{repertoire_id}")(get_repertoire_by_id)
router.post("/repertoire/{repertoire_id}")(get_repertoire_by_id)


@router.api_route("/rearrangement")
def get_rearrangements(
    airr_filter: AirrQueryModel,
    user: Annotated[Optional[UserData], Depends(OidcWorkflow.get_optional_userinfo)]
) -> StreamingResponse:
    annotation_db = filter_annotations_by_query(airr_filter)

    logger.debug(f"Found annotations {len(annotation_db)}")

    dataset_ids = [annotation.id_dataset for annotation in annotation_db if annotation is not None]

    logger.debug(f"Found datasets {dataset_ids}")

    datasets = DatasetRepository.get_all_in(dataset_ids)

    if not datasets:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No datasets found for the given repertoire ID.")

    accessible_datasets = []

    for dataset in datasets:
        sample = SampleRepository.get(dataset.id_sample)

        if sample:
            subject = SubjectRepository.get(sample.id_subject)

            if subject:
                study = StudyRepository.get(subject.id_study)

                if study:
                    # Anonymous users only see public studies
                    if user is None and not study.public:
                        logger.debug(f"Skipping dataset {dataset.id} from non-public study")
                        continue

                    accessible_datasets.append(dataset)

                else:
                    logger.debug(f"Skipping dataset {dataset.id} from inaccessible study")
            else:
                logger.debug(f"Skipping dataset {dataset.id} - subject not found")
        else:
            logger.debug(f"Skipping dataset {dataset.id} - sample not found")

    if not accessible_datasets:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=("No accessible datasets available for the given criteria." ))

    df = pd.DataFrame()

    filename_concats: list[str] = []

    for dataset in accessible_datasets:

        if not os.path.isfile(dataset.filepath):
            logger.warning(f"Dataset with ID {dataset.id} doesn't have a physical file at {dataset.filepath}.")
            continue

        contents = Files.get_file_raw(dataset.filepath, None)

        if not contents:
            continue

        df = pd.concat([df, pd.read_csv(StringIO(contents), sep="\t",),],ignore_index=True)

        filename_concats.append(dataset.filename)

    buffer = StringIO()

    df.to_csv(buffer, sep="\t", index=False)

    buffer.seek(0)

    final_filename = (
        "_".join(filename_concats) if len(filename_concats) else "rearrangements.tsv"
    )

    return StreamingResponse(buffer, media_type="text/tab-separated-values",
        headers={
            "Content-Disposition":
                f"attachment; filename={final_filename}"
        },
    )

router.get("/rearrangement")(get_rearrangements)
router.post("/rearrangement")(get_rearrangements)
