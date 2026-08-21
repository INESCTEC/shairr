import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, status, File, UploadFile
from fastapi.responses import Response


from schemas.json.Genotype import GenotypeCreate
from schemas.dao.Genotype import GenotypeRepository
from core.Auth import OidcWorkflow
from schemas.dao.Subject import SubjectRepository
from schemas.dao.Sample import SampleRepository
from schemas.json.Subject import SubjectResponse, SubjectCreate, SubjectUpdate
from schemas.dao.TimePoint import TimePointRepository
from schemas.json.User import UserData
import csv
from io import StringIO
from fastapi.responses import Response
from core.Database import SessionManager
from sqlalchemy import text

router = APIRouter()

logger = logging.getLogger(__name__)


@router.get("/subject")
def list_subjects(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)]
) -> list[SubjectResponse]:
    return SubjectRepository.get_all()


@router.get("/subject/{id_subject}")
def get_subject(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_subject: int,
) -> SubjectResponse:
    subject = SubjectRepository.get(id_subject)

    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return SubjectResponse.from_db_model(subject)


@router.post(
    "/subject",
    status_code=status.HTTP_201_CREATED
)
def create_subject(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    subject_create: SubjectCreate
) -> SubjectResponse:
    existing = SubjectRepository.get_by_subject_id_and_study(
        subject_create.subject_id, 
        subject_create.id_study
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Subject with ID '{subject_create.subject_id}' already exists in this study"
        )
    created = SubjectRepository.create_from_pydantic(subject_create)
    return SubjectResponse.model_validate(created)


@router.put(
    "/subject/{id_subject}",
    status_code=status.HTTP_204_NO_CONTENT
)
def update_subject(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_subject: int,
    subject_patch: SubjectUpdate
):
    subject = SubjectRepository.get(id_subject)
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    if subject_patch.subject_id and subject_patch.subject_id != subject.subject_id:
        existing = SubjectRepository.get_by_subject_id_and_study(
            subject_patch.subject_id,
            subject_patch.id_study or subject.id_study
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Subject with ID '{subject_patch.subject_id}' already exists in this study"
            )
    
    updated = SubjectRepository.update(
        id_subject, subject_patch.model_dump(exclude_unset=True))
    
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

@router.delete(
    "/subject/{id_subject}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_subject(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_subject: int
):

    
    subject = SubjectRepository.get(id_subject)

    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    with SessionManager() as session:
        result = session.execute(
            text("SELECT id FROM sample WHERE id_subject = :id_subject"),
            {"id_subject": id_subject}
        )
        
        sample_ids = [row[0] for row in result.fetchall()]
        
        if sample_ids:
            placeholders = ','.join([f':id_{i}' for i in range(len(sample_ids))])
            params = {f'id_{i}': sample_id for i, sample_id in enumerate(sample_ids)}
            
            session.execute(
                text(f"UPDATE read SET id_sample = NULL WHERE id_sample IN ({placeholders})"),
                params
            )
            
            session.execute(
                text(f"UPDATE annotation SET id_sample = NULL WHERE id_sample IN ({placeholders})"),
                params
            )
            
            session.commit()
    
    timepoints = TimePointRepository.get_by_subject(id_subject)
    for timepoint in timepoints:
        TimePointRepository.remove(timepoint.id)
    
    samples = SampleRepository.get_by_subject(id_subject)
    for sample in samples:
        SampleRepository.remove(sample.id)
    
    genotypes = GenotypeRepository.get_by_subject_id(id_subject)
    for genotype in genotypes:
        GenotypeRepository.remove(genotype.id)
    
    if not SubjectRepository.remove(id_subject):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

@router.get("/subject/{id_subject}/download")
def download_subject_csv(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_subject: int,
):
    subject = SubjectRepository.get(id_subject)

    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    csv_data = SubjectRepository.generate_csv(id_subject)

    # Convert string to bytes and return as proper file response

    return Response(
        content=csv_data.encode('utf-8'),  # Convert string to bytes
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=subject_{id_subject}.csv"
        }
    )


@router.get("/subjects/download")
def download_all_subjects_csv(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
):
    subjects = SubjectRepository.get_all()

    if not subjects:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    # Generate CSV header
    csv_lines = ["subject_id,synthetic,species,genotypes"]

    for subject in subjects:
        # Handle species 
        species = subject.species
        if isinstance(species, dict):
            species_str = f"{species.get('label', '')} ({species.get('id', '')})"
        elif isinstance(species, str):
            species_str = species
        else:
            species_str = ""

        # Handle genotypes
        mhc_genotype = subject.genotypes
        if mhc_genotype:
            if isinstance(mhc_genotype, list):
                genotype_parts = []
                for item in mhc_genotype:
                    name = getattr(item, 'name', '')
                    mhc_class = getattr(item, 'mhc_class', '')
                    if hasattr(mhc_class, 'value'):
                        mhc_class = mhc_class.value
                    genotype_parts.append(f"{name}({mhc_class})")
                mhc_genotype_str = ';'.join(genotype_parts)
            else:
                # Single genotype
                name = getattr(mhc_genotype, 'name', '')
                mhc_class = getattr(mhc_genotype, 'mhc_class', '')
                if hasattr(mhc_class, 'value'):
                    mhc_class = mhc_class.value
                mhc_genotype_str = f"{name}({mhc_class})"
        else:
            mhc_genotype_str = ""

        # Build CSV line
        line = f"{subject.subject_id},{str(subject.synthetic).lower()},{species_str},{mhc_genotype_str}"
        csv_lines.append(line)

    csv_data = "\n".join(csv_lines)

    return Response(
        content=csv_data.encode('utf-8'),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=all_subjects.csv"
        }
    )


@router.post("/subjects/import")
async def import_subjects_csv(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    csv_file: UploadFile = File(...),
    selected_study_id: int = Form(...,
                                  description="The study ID to associate subjects with")
):
    if not csv_file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    csv_content = await csv_file.read()
    csv_content = csv_content.decode('utf-8')

    reader = csv.reader(StringIO(csv_content))
    header = next(reader, None)
    expected_header = ["subject_id", "synthetic", "species", "genotypes"]
    if header != expected_header:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid CSV header. Expected: {expected_header}, got: {header}"
        )

    created_count = 0
    errors = []
    duplicate_ids = []  # Track duplicate subject_ids for better error reporting

    # Get all existing subject_ids for this study to check duplicates efficiently
    existing_subjects = SubjectRepository.get_by_study_id(selected_study_id)
    existing_subject_ids = {subject.subject_id for subject in existing_subjects}

    for line_num, row in enumerate(reader, start=2):
        if len(row) != 4:
            errors.append(
                f"Line {line_num}: expected 4 fields, got {len(row)}")
            continue

        subject_id, synthetic, species, genotypes = row
        subject_id = subject_id.strip()

        if not subject_id:
            errors.append(f"Line {line_num}: subject_id cannot be empty")
            continue

        # Check if subject_id already exists in this study
        if subject_id in existing_subject_ids:
            duplicate_ids.append(subject_id)
            errors.append(
                f"Line {line_num}: subject_id '{subject_id}' already exists in study {selected_study_id}"
            )
            continue

        try:
            synthetic_bool = synthetic.lower() == 'true'

            species_dict = {}
            if species and '(' in species and ')' in species:
                label_part = species.split('(')[0].strip()
                id_part = species.split('(')[1].replace(')', '').strip()
                species_dict = {'label': label_part, 'id': id_part}

            mhc_genotypes = []
            if genotypes.strip():
                genotype_parts = genotypes.split(';')
                for part in genotype_parts:
                    if part and '(' in part and ')' in part:
                        name_part = part.split('(')[0].strip()
                        class_part = part.split(
                            '(')[1].replace(')', '').strip()
                        mhc_genotypes.append({
                            "name": name_part,
                            "mhc_class": class_part
                        })

            subject_create = SubjectCreate(
                id_study=selected_study_id,
                subject_id=subject_id,
                synthetic=synthetic_bool,
                species=species_dict if species_dict else None
            )

            created_subject = SubjectRepository.create_from_pydantic(
                  subject_create)

            # Add the new subject_id to the set to prevent duplicates within the same import
            existing_subject_ids.add(subject_id)

            for genotype in mhc_genotypes:
                genotype_create = GenotypeCreate(
                        id_subject=created_subject.id,
                        name=genotype["name"],
                        mhc_class=genotype["mhc_class"]
                    )
                GenotypeRepository.create_from_pydantic(genotype_create)

            created_count += 1

        except Exception as e:
            errors.append(f"Line {line_num}: {str(e)}")
            continue

    # Build response with structured error information
    response = {
        "detail": f"Successfully imported {created_count} subjects",
        "imported_count": created_count,
        "total_lines": len(list(reader)) + 1,  # Approximate total
        "duplicate_ids": list(set(duplicate_ids)),  # Unique duplicate IDs
        "duplicate_count": len(set(duplicate_ids))
    }
    
    if errors:
        response["errors"] = errors
        response["detail"] += f" with {len(errors)} errors"

    return response


@router.get("/subject/{id_subject}/samples/download")
def download_samples_csv_from_subject(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_subject: int
):
    samples = SampleRepository.get_by_subject(id_subject)

    if not samples:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    output = StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    
    writer.writerow(["sample_id", "subject_id", "timepoint_id", "sample_type", "tissue", "cell_subset", "cell_phenotype", "sequencing_type"])
    
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

        if (sample.id_timepoint is None):
            logger.warning('The Timepoint ID for the current sample is None.')
            pass
        
        writer.writerow([
            sample.sample_id,
            subject_id,
            int(sample.id_timepoint) if sample.id_timepoint is not None else "",
            sample.sample_type or "",
            tissue,
            cell_subset,
            sample.cell_phenotype or "",
            sequencing_type
        ])
    
    csv_data = output.getvalue()

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=samples_subject_{id_subject}.csv"
        }
    )
@router.put("/subject/{source_id}/template/study")
async def apply_timeline_template_to_study(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    source_id: int
):
    try:
        subject = SubjectRepository.get_by_subject_id(source_id)
        
        if subject is None:
            raise HTTPException(status_code=404, detail=f"Subject with id {source_id} not found")
        
        study_id = subject.id_study
        
        subjects = SubjectRepository.get_subjects_by_study(study_id)
        
        for subject_item in subjects:
            SubjectRepository.apply_timeline_template(subject_item.id, source_id)
        
        return {
            "message": f"Timeline template applied successfully to {len(subjects)} subjects in study {study_id}"
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/subject/{target_id}/template/{source_id}")
async def apply_timeline_template(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    target_id: int,
    source_id: int,
):
    try:
        SubjectRepository.apply_timeline_template(target_id, source_id)
        return {"message": "Timeline template applied successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
