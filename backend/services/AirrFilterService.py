from typing import Optional
import logging
from fastapi import HTTPException, status

from core.Config import config
from schemas.dao.Annotation import AnnotationRepository
from schemas.db.Annotation import Annotation
from schemas.json.airr.AirrFilter import AirrFilters, AirrFilterItem, AirrQueryModel, AirrFilterContent

logger = logging.getLogger(__name__)

def get_filter_items_list(filters: Optional[AirrFilters]) -> list[AirrFilterItem]:
    """
    Normalize AirrFilters.content into a list[AirrFilterItem], regardless of whether
    the user sent:
      - filters: { op: "=", content: {field, value} }
      - filters: { op: "and", content: { op, content: {field, value} } }
      - filters: { op: "and", content: [ {op, content}, ... ] }
    """
    if filters is None:
        return []

    content = filters.content

    # Case 1: already a list of AirrFilterItem
    if isinstance(content, list):
        return content

    # Case 2: single AirrFilterItem
    if isinstance(content, AirrFilterItem):
        return [content]

    # Case 3: plain AirrFilterContent — wrap it in an AirrFilterItem using filters.op
    # Only allowed if filters.op is a comparison operator, not a logical one.
    if isinstance(content, AirrFilterContent):
        if filters.op in ("and", "or"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "When using 'and'/'or' at the top level, "
                    "filters.content must be a filter item or list of items, "
                    "not a single {field, value} object."
                ),
            )
        return [AirrFilterItem(op=filters.op, content=content)]

    # Fallback — should not happen if the model is correct
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid filters.content structure.",
    )

def determine_filter_mode(query: AirrQueryModel):
    """
    Enforce allowed filter patterns:

      - sample_id only
      - subject_id AND study_id together
      - repertoire_id

    Returns:
      ("sample", {"operator": ..., "value": ...})
      OR
      ("repertoire_study", {"subject_id": ..., "study_id": ...})
    """
    filter_items = get_filter_items_list(query.filters)

    # Map "field name" -> AirrFilterItem
    field_to_filter_item: dict[str, AirrFilterItem] = {}

    for filter_item in filter_items:
        field_name = filter_item.content.field

        if field_name in field_to_filter_item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate filter for field '{field_name}' is not allowed.",
            )
        field_to_filter_item[field_name] = filter_item

    requested_fields = set(field_to_filter_item.keys())

    # Case 1: filter by sample_id only
    if requested_fields == {"sample_id"}:
        sample_filter_item = field_to_filter_item["sample_id"]

        if sample_filter_item.op not in ("=", "in"):
            raise HTTPException(
                status_code=400,
                detail="Only '=' and 'in' operators are supported for sample_id.",
            )

        return "sample", {
            "operator": sample_filter_item.op,
            "value": sample_filter_item.content.value,
        }

    # Case 2: filter by subject_id AND study_id
    elif requested_fields == {"subject_id", "study_id"}:
        repertoire_filter_item = field_to_filter_item["subject_id"]
        study_filter_item = field_to_filter_item["study_id"]

        if repertoire_filter_item.op != "=" or study_filter_item.op != "=":
            raise HTTPException(
                status_code=400,
                detail="Only '=' operator is supported for subject_id and study_id.",
            )

        repertoire_value = repertoire_filter_item.content.value
        study_value = study_filter_item.content.value

        if isinstance(repertoire_value, list) or isinstance(study_value, list):
            raise HTTPException(
                status_code=400,
                detail="subject_id and study_id must be single values.",
            )

        return "subject_study", {
            "subject_id": repertoire_value,
            "study_id": study_value,
        }

    # Case 3: filter by repertoire_id which is essentially a joint version of subject_id and study_id
    elif requested_fields == {"repertoire_id"}:
        repertoire_value = field_to_filter_item["repertoire_id"]

        if isinstance(repertoire_value, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="subject_id and study_id must be single values.",
            )

        return "repertoire", {
            "operator": repertoire_value.op,
            "value": repertoire_value.content.value,
        }

    # Anything else is not supported (extra fields, missing one of the pair, etc.)
    raise HTTPException(
        status_code=400,
        detail=(
            "Unsupported filter combination. Only either:\n"
            " - sample_id (single filter), OR\n"
            " - subject_id AND study_id together\n"
            " - repertoire_id\n"
            "are supported at the moment."
        ),
    )


def project_rearrangement_fields(
    rearrangement: dict, requested_fields: list[str]
) -> dict:
    """Apply field projection. If no fields are requested, return the full record."""
    if not requested_fields:
        return rearrangement
    return {field_name: rearrangement.get(field_name) for field_name in requested_fields}
# --------------------------------------------------------------------


# --------------------------------------------------------------------
# Core filtering logic
# --------------------------------------------------------------------
def filter_annotations_by_query(
    query: AirrQueryModel
) -> list[Annotation]:
    filter_mode, filter_config = determine_filter_mode(query)

    if filter_mode == "sample":
        operator = filter_config["operator"]
        filter_value = filter_config["value"]

        logger.debug(f"Filtering by sample with value {filter_value}")

        if operator == "=":
            if isinstance(filter_value, list):
                return AnnotationRepository.get_by_sample_ids(filter_value)
            else:
                return [AnnotationRepository.get_by_sample_id(filter_value)]
        else:  # operator == "in"
            if not isinstance(filter_value, list):
                raise HTTPException(
                    status_code=400,
                    detail="IN operator for sample_id requires a list of values.",
                )
            return AnnotationRepository.get_by_sample_ids(filter_value)

    elif filter_mode == "subject_study":
        logger.debug(f"Filtering by subject_study with values {filter_config['study_id']} and {filter_config['subject_id']}")
        return AnnotationRepository.get_by_study_and_subject(filter_config["study_id"], filter_config["subject_id"])

    elif filter_mode == "repertoire":
        study_id, subject_id = filter_config["value"].split(config.repertoire_separator)
        logger.debug(f"Filtering by repertoire with values for study id: {study_id} and subject id:  {subject_id}")

        return AnnotationRepository.get_by_study_and_subject(study_id, subject_id)

    else:
        # Should not be reachable
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal filter mode error.")
