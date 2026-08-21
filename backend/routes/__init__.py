import logging

from fastapi import APIRouter

from routes.Home import router as home_router
from routes.User import router as user_router
from routes.Dataset import router as dataset_router
from routes.Annotation import router as annotation_router
from routes.Diagnosis import router as diagnosis_router
from routes.Read import router as read_router
from routes.Airr import router as airr_router
from routes.Repository import router as repository_router
from routes.Sample import router as sample_router
from routes.Study import router as study_router
from routes.Subject import router as subject_router
from routes.TimePoint import router as timepoint_router
from routes.Genotype import router as genotype_router
from routes.UploadWebsocket import router as uw_router
from routes.Disease import router as disease_router
from routes.Species import router as species_router
from routes.Cell import router as cell_router
from routes.Uberon import router as uberon_router
from routes.Task import router as task_router
from routes.Tool import router as tool_router

logger = logging.getLogger(__name__)

router = APIRouter()
router.include_router(home_router, tags=["Home"])
router.include_router(user_router, tags=["Users"])
router.include_router(dataset_router, tags=["Datasets"])
router.include_router(study_router, tags=["Studies"])
router.include_router(subject_router, tags=["Subjects"])
router.include_router(sample_router, tags=["Samples"])
router.include_router(annotation_router, tags=["Annotations"])
router.include_router(read_router, tags=["Reads"])
router.include_router(airr_router, tags=["AIRR"], prefix="/airr/v1")
router.include_router(diagnosis_router, tags=["Diagnosis"])
router.include_router(timepoint_router, tags=["Timepoints"])
router.include_router(repository_router, tags=["Repository"])
router.include_router(genotype_router, tags=["Genotypes"])
router.include_router(uw_router, tags=["Upload Websocket"])
router.include_router(disease_router, prefix="/disease", tags=["Diseases"])
router.include_router(species_router, prefix="/species", tags=["Species"])
router.include_router(cell_router, prefix="/cell", tags=["Cell"])
router.include_router(uberon_router, prefix="/uberon", tags=["Uberon (Tissue)"])
router.include_router(task_router, tags=["Tasks"])
router.include_router(tool_router, tags=["Tools"])

__all__ = ["router"]