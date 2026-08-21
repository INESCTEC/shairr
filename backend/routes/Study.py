import logging
from sqlalchemy import text
from typing import Annotated
import csv
from io import StringIO

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status

from core.Database import SessionManager
from core.Auth import OidcWorkflow
from schemas.dao.Study import StudyRepository
from schemas.dao.Sample import SampleRepository
from schemas.json.Study import StudyResponse, StudyCreate, StudyUpdate
from schemas.json.User import UserData
from schemas.dao.TimePoint import TimePointRepository
from schemas.dao.Subject import SubjectRepository
from schemas.dao.Genotype import GenotypeRepository

from schemas.dao.Subject import SubjectRepository

router = APIRouter()

logger = logging.getLogger(__name__)

@router.get( "/study")
def list_studies(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)]
) -> list[StudyResponse]:
    studies = StudyRepository.get_all()
    return [StudyResponse.model_validate(study) for study in studies]

@router.put("/study/{id_study}/stats")
def toggle_stats_in_study(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_study: int
) -> bool:
    study = StudyRepository.get_by_study_id(id_study)

    return StudyRepository.toggle_stats_flag(study)


@router.get("/study/{id_study}")
def get_study(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_study: int,
) -> StudyResponse:
    study = StudyRepository.get(id_study)

    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return StudyResponse.model_validate(study)


@router.post(
    "/study",
    status_code=status.HTTP_201_CREATED
)
def create_study(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    study_create: StudyCreate
) -> StudyResponse:
    existing_study = StudyRepository.get_by_study_id(study_create.study_id)
    if existing_study:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Study with ID '{study_create.study_id}' already exists"
        )
    created = StudyRepository.create_from_pydantic(study_create)
    return StudyResponse.model_validate(created)


@router.put(
    "/study/{id_study}",
    status_code=status.HTTP_204_NO_CONTENT
)
def update_study(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_study: int,
    study_patch: StudyUpdate
):
    existing_study = StudyRepository.get(id_study)
    if not existing_study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    if study_patch.study_id and study_patch.study_id != existing_study.study_id:
        duplicate = StudyRepository.get_by_study_id(study_patch.study_id)
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Study with ID '{study_patch.study_id}' already exists"
            )
    
    study = StudyRepository.update(id_study, study_patch.model_dump(exclude_unset=True))

    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

@router.put(
    "/study/{id_study}/public-status"
)
def toggle_public_status(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_study: int
):
    study = StudyRepository.get(id_study)

    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return StudyRepository.toggle_public_status(study.id)

@router.put(
    "/study/{id_study}/stats-selection"
)
def toggle_stats_selection(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_study: int
):
    study = StudyRepository.get(id_study)

    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return StudyRepository.toggle_stats_selection(study.id)

@router.delete(
    "/study/{id_study}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_study(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_study: int
):   
    with SessionManager() as session:
        # Start a transaction
        with session.begin():
            study = StudyRepository.get(id_study)
            if not study:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
            
            # Let SQLAlchemy handle the cascade if relationships are configured
            # Or manually delete with proper order
            
            # Delete all related data in correct order
            session.execute(
                text("""
                    DELETE FROM time_point 
                    WHERE id_subject IN (
                        SELECT id FROM subject WHERE id_study = :id_study
                    )
                """),
                {"id_study": id_study}
            )
            
            session.execute(
                text("""
                    DELETE FROM sample WHERE id_study = :id_study
                """),
                {"id_study": id_study}
            )
            
            session.execute(
                text("""
                    DELETE FROM genotype 
                    WHERE id_subject IN (
                        SELECT id FROM subject WHERE id_study = :id_study
                    )
                """),
                {"id_study": id_study}
            )
            
            session.execute(
                text("DELETE FROM subject WHERE id_study = :id_study"),
                {"id_study": id_study}
            )
            
            session.delete(study)
            # session.commit() happens automatically on exiting the with block

@router.get("/study/{id_study}/download")
def download_study_csv(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_study: int,
):
    study = StudyRepository.get(id_study)

    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    csv_data = StudyRepository.generate_csv(id_study)

    return Response(
        content=csv_data.encode('utf-8'),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=study_{id_study}.csv"
        }
    )

@router.get("/studies/download")
def download_all_studies_csv(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
):
    studies = StudyRepository.get_all()

    if not studies:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    output = StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_ALL)
    
    writer.writerow(["study_id", "study_title", "study_description", "contributors"])
    
    for study in studies:
        writer.writerow([
            study.study_id,
            study.study_title,
            study.study_description or "",
            study.contributors or ""
        ])
    
    csv_data = output.getvalue()

    from fastapi.responses import Response
    return Response(
        content=csv_data.encode('utf-8'),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=all_studies.csv"
        }
    )


@router.post("/studies/import")
async def import_studies_csv(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    csv_file: UploadFile = File(...)
):
    import csv
    from io import StringIO
    
    if not csv_file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    csv_content = await csv_file.read()
    csv_content = csv_content.decode('utf-8')
    
    reader = csv.reader(
        StringIO(csv_content),
        quotechar='"',
        quoting=csv.QUOTE_MINIMAL
    )
    
    header = next(reader, None)
    expected_header = ["study_id", "study_title", "study_description", "contributors"]
    if header != expected_header:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid CSV header. Expected: {expected_header}, got: {header}"
        )
    
    created_count = 0
    errors = []
    
    for line_num, row in enumerate(reader, start=2):
        if len(row) < 4:
            errors.append(f"Line {line_num}: has insufficient fields (expected 4, got {len(row)})")
            continue
        
        study_id, study_title, study_description, contributors = row
        
        if not study_id.strip():
            continue
        
        try:
            existing_study = StudyRepository.get_by_study_id(study_id)
            if existing_study:
                errors.append(f"Line {line_num}: study_id '{study_id}' already exists")
                continue
            
            study_create = StudyCreate(
                study_id=study_id.strip(),
                study_title=study_title.strip(),
                study_description=study_description.strip() if study_description else None,
                contributors=contributors.strip() if contributors else None
            )
            
            StudyRepository.create_from_pydantic(study_create)
            created_count += 1
            
        except Exception as e:
            errors.append(f"Line {line_num}: {str(e)}")
            continue
    
    response = {"detail": f"Successfully imported {created_count} studies"}
    if errors:
        response["errors"] = errors
        response["detail"] += f" with {len(errors)} errors"
    
    return response

@router.get("/study/{study_id}/subjects/download")
def download_all_subjects_csv(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    study_id: int
):
    subjects = SubjectRepository.get_by_study_id(study_id)

    if not subjects:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    csv_lines = ["subject_id,synthetic,species,genotypes"]
    
    for subject in subjects:
        species_str = ""
        if subject.species:
            if isinstance(subject.species, dict):
                label = subject.species.get('label', '')
                id_val = subject.species.get('id', '')
                species_str = f"{label} ({id_val})"
            elif hasattr(subject.species, 'label') and hasattr(subject.species, 'id'):
                species_str = f"{subject.species.label} ({subject.species.id})"
            else:
                species_str = str(subject.species)
        
        mhc_genotype_str = ""
        if subject.genotypes:
            if isinstance(subject.genotypes, list):
                parts = []
                for item in subject.genotypes:
                    name = getattr(item, 'name', '')
                    mhc_class = getattr(item, 'mhc_class', '')
                    if hasattr(mhc_class, 'value'):
                        mhc_class = mhc_class.value
                    parts.append(f"{name}({mhc_class})")
                mhc_genotype_str = ';'.join(parts)
            else:
                name = getattr(subject.genotypes, 'name', '')
                mhc_class = getattr(subject.genotypes, 'mhc_class', '')
                if hasattr(mhc_class, 'value'):
                    mhc_class = mhc_class.value
                mhc_genotype_str = f"{name}({mhc_class})"
        
        line = f"{subject.subject_id},{str(subject.synthetic).lower()},{species_str},{mhc_genotype_str}"
        csv_lines.append(line)
    
    csv_data = "\n".join(csv_lines)

    from fastapi.responses import Response
    return Response(
        content=csv_data.encode('utf-8'),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=subjects_study_{study_id}.csv"
        }
    )


@router.get("/study/{study_id}/samples/download")
def download_all_samples_csv(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    study_id: int
):
    samples = SampleRepository.get_by_study_id(study_id)

    if not samples:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    import csv
    from io import StringIO
    
    output = StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    
    writer.writerow(["sample_id", "timepoint_id", "sample_type", "tissue", "cell_subset", "cell_phenotype", "sequencing_type"])
    
    for sample in samples:
        subject_id = str(sample.id_subject) if sample.id_subject else ""
        
        tissue = ""
        if sample.tissue:
            if isinstance(sample.tissue, dict):
                label = sample.tissue.get('label', '')
                id_val = sample.tissue.get('id', '')
                tissue = f"{label} ({id_val})" if label and id_val else (label or id_val or "")
            else:
                tissue = str(sample.tissue)
        
        cell_subset = ""
        if sample.cell_subset:
            if isinstance(sample.cell_subset, dict):
                label = sample.cell_subset.get('label', '')
                id_val = sample.cell_subset.get('id', '')
                cell_subset = f"{label} ({id_val})" if label and id_val else (label or id_val or "")
            else:
                cell_subset = str(sample.cell_subset)
        
        sequencing_type = sample.sequencing_type.value if sample.sequencing_type else ""

        timepoint_id = sample.id_timepoint
        
        writer.writerow([
            sample.sample_id,
            timepoint_id,
            sample.sample_type or "",
            tissue,
            cell_subset,
            sample.cell_phenotype or "",
            sequencing_type
        ])
    
    csv_data = output.getvalue()

    from fastapi.responses import Response
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=samples_study_{study_id}.csv"
        }
    )