import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Form, HTTPException, status, UploadFile, File

import json
from schemas.dao.Annotation import AnnotationRepository
from core.Auth import OidcWorkflow
from schemas.dao.Sample import SampleRepository
from schemas.dao.Subject import SubjectRepository
from schemas.db.SequencingType import SequencingType
from schemas.json.Ontology import OntologyCreate
from schemas.json.Sample import SampleResponse, SampleCreate, SampleUpdate
from schemas.json.User import UserData

router = APIRouter()

logger = logging.getLogger(__name__)

@router.get( "/sample")
def list_samples(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)]
) -> list[SampleResponse]:
    samples = SampleRepository.get_all()
    return [SampleResponse.model_validate(sample, from_attributes=True) for sample in samples]


@router.get("/sample/datasets")
def get_sample_datasets(
    user: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
) -> dict:
    annotations = AnnotationRepository.get_all()
    mapping = {}
    for ann in annotations:
        if ann.id_sample:
            sample = SampleRepository.get(ann.id_sample)
            if sample and sample.sample_id:
                if sample.sample_id not in mapping:
                    mapping[sample.sample_id] = []
                mapping[sample.sample_id].append(ann.id_dataset)
    return mapping

@router.get("/sample/{id_sample}")
def get_sample(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_sample: int,
) -> SampleResponse:
    sample = SampleRepository.get(id_sample)

    if not sample:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return SampleResponse.model_validate(sample, from_attributes=True)


@router.post(
    "/sample",
    status_code=status.HTTP_201_CREATED
)
def create_sample(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    sample_create: SampleCreate
) -> SampleResponse:
    def check_empty_strings(obj, path=""):
        if hasattr(obj, 'dict') and callable(getattr(obj, 'dict')):
            for field_name, value in obj.dict().items():
                current_path = f"{path}.{field_name}" if path else field_name
                if isinstance(value, str) and value.strip() == "":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Field '{current_path}' cannot be empty"
                    )
                elif hasattr(value, 'dict') or isinstance(value, dict):
                    check_empty_strings(value, current_path)
        elif isinstance(obj, dict):
            for key, value in obj.items():
                current_path = f"{path}.{key}" if path else key
                if isinstance(value, str) and value.strip() == "":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Field '{current_path}' cannot be empty"
                    )
                elif hasattr(value, 'dict') or isinstance(value, dict):
                    check_empty_strings(value, current_path)
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                check_empty_strings(item, f"{path}[{i}]")
    
    check_empty_strings(sample_create)
    
    existing = SampleRepository.get_by_sample_id_and_subject(
        sample_create.sample_id,
        sample_create.id_subject
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sample with ID '{sample_create.sample_id}' already exists for this subject"
        )
    
    created = SampleRepository.create_from_pydantic(sample_create)
    return SampleResponse.model_validate(created, from_attributes=True)

@router.put(
    "/sample/{id_sample}",
    status_code=status.HTTP_200_OK
)
def update_sample(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_sample: int,
    sample_patch: SampleUpdate
) -> SampleResponse:
    logger.debug(f"=== UPDATE SAMPLE {id_sample} ===")
    
    sample = SampleRepository.get(id_sample)
    if not sample:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    logger.debug(f"Before update: tissue={sample.tissue}, cell_subset={sample.cell_subset}")
    
    if sample_patch.sample_id and sample_patch.sample_id != sample.sample_id:
        existing = SampleRepository.get_by_sample_id_and_subject(
            sample_patch.sample_id,
            sample_patch.id_subject or sample.id_subject
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Sample with ID '{sample_patch.sample_id}' already exists for this subject"
            )
    
    update_data = sample_patch.model_dump(exclude_unset=True)
    logger.debug(f"Update data: {update_data}")
    
    if 'tissue' in update_data and isinstance(update_data['tissue'], dict):
        update_data['tissue'] = json.dumps(update_data['tissue'])
        logger.debug(f"Tissue converted to: {update_data['tissue']}")
    
    if 'cell_subset' in update_data and isinstance(update_data['cell_subset'], dict):
        update_data['cell_subset'] = json.dumps(update_data['cell_subset'])
        logger.debug(f"Cell subset converted to: {update_data['cell_subset']}")
    
    if not update_data:
        return SampleResponse.model_validate(sample, from_attributes=True)
    
    logger.debug(f"Final update data: {update_data}")
    
    updated = SampleRepository.update(id_sample, update_data)
    logger.debug(f"Updated object: {updated}")
    
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    logger.debug(f"After update: tissue={updated.tissue}, cell_subset={updated.cell_subset}")
    
    return SampleResponse.model_validate(updated, from_attributes=True)

@router.delete(
    "/sample/{id_sample}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_sample(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_sample: int
):
    from core.Database import SessionManager
    from sqlalchemy import text
    
    sample = SampleRepository.get(id_sample)

    if not sample:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    with SessionManager() as session:
        session.execute(
            text("UPDATE read SET id_sample = NULL WHERE id_sample = :id_sample"),
            {"id_sample": id_sample}
        )
        
        session.execute(
            text("UPDATE annotation SET id_sample = NULL WHERE id_sample = :id_sample"),
            {"id_sample": id_sample}
        )
        
        session.commit()
    
    if not SampleRepository.remove(id_sample):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
@router.get("/sample/{id_sample}/download")
def download_sample_csv(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_sample: int,
):
    sample = SampleRepository.get(id_sample)

    if not sample:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    csv_data = SampleRepository.generate_csv(id_sample)

    from fastapi.responses import Response
    return Response(
        content=csv_data.encode('utf-8'),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=sample_{id_sample}.csv"
        }
    )


@router.get("/samples/download")
def download_all_samples_csv(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
):
    samples = SampleRepository.get_all()

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
                if label and id_val:
                    tissue = f"{label} ({id_val})"
                else:
                    tissue = label or id_val or ""
            else:
                tissue = str(sample.tissue)
        
        cell_subset = ""
        if sample.cell_subset:
            if isinstance(sample.cell_subset, dict):
                label = sample.cell_subset.get('label', '')
                id_val = sample.cell_subset.get('id', '')
                if label and id_val:
                    cell_subset = f"{label} ({id_val})"
                else:
                    cell_subset = label or id_val or ""
            else:
                cell_subset = str(sample.cell_subset)
        
        sequencing_type = sample.sequencing_type.value if sample.sequencing_type else ""
        
        writer.writerow([
            sample.sample_id,
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
            "Content-Disposition": "attachment; filename=all_samples.csv"
        }
    )

@router.post("/samples/import")
async def import_samples_csv(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    csv_file: UploadFile = File(...),
    selected_study_id: int = Form(...),
    selected_subject_id: Optional[int] = Form(None)
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
    expected_header = ["sample_id", "timepoint_id", "sample_type", "tissue", "cell_subset", "cell_phenotype", "sequencing_type"]
    if header != expected_header:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid CSV header. Expected: {expected_header}, got: {header}"
        )
    
    created_count = 0
    errors = []
    duplicate_sample_ids = []
    missing_subjects = []
    
    subjects = SubjectRepository.get_by_study_id(selected_study_id)
    subject_ids = {subject.id for subject in subjects}
    subject_id_to_subject_id = {subject.id: subject.subject_id for subject in subjects}
    
    existing_samples = SampleRepository.get_by_study_id(selected_study_id)
    existing_sample_keys = {(sample.sample_id, sample.id_subject) for sample in existing_samples}
    
    for line_num, row in enumerate(reader, start=2):
        if len(row) != 7:
            errors.append(f"Line {line_num}: expected 7 fields, got {len(row)}")
            continue
        
        sample_id, timepoint_id, sample_type, tissue_str, cell_subset_str, cell_phenotype, sequencing_type = row
        
        sample_id = sample_id.strip()
        if not sample_id:
            errors.append(f"Line {line_num}: sample_id cannot be empty")
            continue
        
        try:           
            sample_key = (sample_id, selected_subject_id)
            if sample_key in existing_sample_keys:
                duplicate_sample_ids.append(sample_id)
                errors.append(f"Line {line_num}: sample_id '{sample_id}' already exists for subject '{SubjectRepository.get_by_subject_id(selected_subject_id).subject_id}'")
                continue
            
            tissue_ontology = None
            if tissue_str and tissue_str.strip():
                tissue_ontology = parse_ontology_string(tissue_str)
            
            cell_subset_ontology = None
            if cell_subset_str and cell_subset_str.strip():
                cell_subset_ontology = parse_ontology_string(cell_subset_str)
            
            sequencing_type_enum = None
            if sequencing_type and sequencing_type.strip():
                try:
                    sequencing_type_enum = SequencingType(sequencing_type.strip())
                except ValueError:
                    errors.append(f"Line {line_num}: invalid sequencing_type '{sequencing_type}'. Valid values: {[t.value for t in SequencingType]}")
                    continue
            
            sample_create = SampleCreate(
                id_subject=selected_subject_id,
                id_study=selected_study_id,
                id_timepoint=timepoint_id.strip() if timepoint_id and timepoint_id.strip() else None,
                sample_id=sample_id,
                sample_type=sample_type.strip() if sample_type and sample_type.strip() else None,
                tissue=tissue_ontology,
                cell_subset=cell_subset_ontology,
                cell_phenotype=cell_phenotype.strip() if cell_phenotype and cell_phenotype.strip() else None,
                sequencing_type=sequencing_type_enum
            )
            
            SampleRepository.create_from_pydantic(sample_create)
            
            existing_sample_keys.add(sample_key)
            created_count += 1
            
        except ValueError as e:
            errors.append(f"Line {line_num}: Invalid subject_id format - {str(e)}")
        except Exception as e:
            errors.append(f"Line {line_num}: {str(e)}")
            continue
    
    response = {
        "detail": f"Successfully imported {created_count} samples",
        "imported_count": created_count,
        "duplicate_sample_ids": list(set(duplicate_sample_ids)),
        "duplicate_count": len(set(duplicate_sample_ids)),
        "missing_subjects": list(set(missing_subjects)),
        "missing_subject_count": len(set(missing_subjects))
    }
    
    if errors:
        response["errors"] = errors
        response["detail"] += f" with {len(errors)} errors"
    
    return response

def parse_ontology_string(ontology_str: str) -> dict:
    if '(' in ontology_str and ')' in ontology_str:
        label = ontology_str.split('(')[0].strip()
        id_part = ontology_str.split('(')[1].replace(')', '').strip()
        return {'label': label, 'id': id_part}
    return {'label': ontology_str.strip(), 'id': ''}