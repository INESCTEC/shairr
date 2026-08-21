from .Disease import DiseaseOntology
from .Species import SpeciesOntology
from .Cell import CellOntology
from .Uberon import UberonOntology
import os
import json
import hashlib
from pathlib import Path
import logging
import pickle
import traceback

logger = logging.getLogger(__name__)

CACHE_DIR = Path("/tmp/shairr_ontology_cache")
CACHE_DIR.mkdir(exist_ok=True)

def get_ontology_hash(owl_file_path: str) -> str:
    logger.info(f"get_ontology_hash called for {owl_file_path}")
    if not Path(owl_file_path).exists():
        logger.warning(f"OWL file not found at {owl_file_path}")
        return "no-file"
    try:
        with open(owl_file_path, 'rb') as f:
            content = f.read()
            file_hash = hashlib.sha256(content).hexdigest()
            logger.info(f"get_ontology_hash returning {file_hash}")
            return file_hash
    except Exception as e:
        logger.error(f"get_ontology_hash error: {e}")
        return "error"

def get_disease_ontology(owl_file_path: str = None):
    logger.info("get_disease_ontology called")
    if owl_file_path is None:
        owl_file_path = os.getenv('DISEASE_OWL_PATH', './ontology/owl/disease/doid-base.owl')
        logger.info(f"get_disease_ontology using path {owl_file_path}")
    
    file_hash = get_ontology_hash(owl_file_path)
    logger.info(f"get_disease_ontology file hash {file_hash}")
    
    cache_file = CACHE_DIR / f"disease_ontology_{file_hash}.pkl"
    logger.info(f"get_disease_ontology cache file {cache_file}")
    logger.info(f"get_disease_ontology cache exists {cache_file.exists()}")
    
    if cache_file.exists():
        try:
            with open(cache_file, 'rb') as f:
                data = pickle.load(f)
                logger.info("get_disease_ontology loaded from cache")
                return data
        except Exception as e:
            logger.error(f"get_disease_ontology cache load failed {e}")
            cache_file.unlink(missing_ok=True)
    
    logger.info("get_disease_ontology loading from OWL file")
    ontology = DiseaseOntology(owl_file_path)
    logger.info("get_disease_ontology loaded from OWL successfully")
    
    with open(cache_file, 'wb') as f:
        pickle.dump(ontology, f)
    logger.info("get_disease_ontology saved to cache")
    
    return ontology

def get_species_ontology(owl_file_path: str = None):
    logger.info("get_species_ontology called")
    if owl_file_path is None:
        owl_file_path = os.getenv('SPECIES_OWL_PATH', './ontology/owl/ncbitaxon/taxslim.owl')
        logger.info(f"get_species_ontology using path {owl_file_path}")
    
    file_hash = get_ontology_hash(owl_file_path)
    logger.info(f"get_species_ontology file hash {file_hash}")
    
    cache_file = CACHE_DIR / f"species_ontology_{file_hash}.pkl"
    logger.info(f"get_species_ontology cache file {cache_file}")
    logger.info(f"get_species_ontology cache exists {cache_file.exists()}")
    
    if cache_file.exists():
        try:
            with open(cache_file, 'rb') as f:
                data = pickle.load(f)
                logger.info("get_species_ontology loaded from cache")
                return data
        except Exception as e:
            logger.error(f"get_species_ontology cache load failed {e}")
            cache_file.unlink(missing_ok=True)
    
    logger.info("get_species_ontology loading from OWL file")
    ontology = SpeciesOntology(owl_file_path)
    logger.info("get_species_ontology loaded from OWL successfully")
    
    with open(cache_file, 'wb') as f:
        pickle.dump(ontology, f)
    logger.info("get_species_ontology saved to cache")
    
    return ontology

def get_cell_ontology(owl_file_path: str = None):
    logger.info("get_cell_ontology called")
    if owl_file_path is None:
        owl_file_path = os.getenv('CELL_OWL_PATH', './ontology/owl/cell/cl-basic.owl')
        logger.info(f"get_cell_ontology using path {owl_file_path}")
    
    file_hash = get_ontology_hash(owl_file_path)
    logger.info(f"get_cell_ontology file hash {file_hash}")
    
    cache_file = CACHE_DIR / f"cell_ontology_{file_hash}.pkl"
    logger.info(f"get_cell_ontology cache file {cache_file}")
    logger.info(f"get_cell_ontology cache exists {cache_file.exists()}")
    
    if cache_file.exists():
        try:
            with open(cache_file, 'rb') as f:
                data = pickle.load(f)
                logger.info("get_cell_ontology loaded from cache")
                return data
        except Exception as e:
            logger.error(f"get_cell_ontology cache load failed {e}")
            cache_file.unlink(missing_ok=True)
    
    logger.info("get_cell_ontology loading from OWL file")
    ontology = CellOntology(owl_file_path)
    logger.info("get_cell_ontology loaded from OWL successfully")
    
    with open(cache_file, 'wb') as f:
        pickle.dump(ontology, f)
    logger.info("get_cell_ontology saved to cache")
    
    return ontology

def get_uberon_ontology(owl_file_path: str = None):
    logger.info("get_uberon_ontology called")
    if owl_file_path is None:
        owl_file_path = os.getenv('UBERON_OWL_PATH', './ontology/owl/uberon/uberon-basic.owl')
        logger.info(f"get_uberon_ontology using path {owl_file_path}")
    
    file_hash = get_ontology_hash(owl_file_path)
    logger.info(f"get_uberon_ontology file hash {file_hash}")
    
    cache_file = CACHE_DIR / f"uberon_ontology_{file_hash}.pkl"
    logger.info(f"get_uberon_ontology cache file {cache_file}")
    logger.info(f"get_uberon_ontology cache exists {cache_file.exists()}")
    
    if cache_file.exists():
        try:
            with open(cache_file, 'rb') as f:
                data = pickle.load(f)
                logger.info("get_uberon_ontology loaded from cache")
                return data
        except Exception as e:
            logger.error(f"get_uberon_ontology cache load failed {e}")
            cache_file.unlink(missing_ok=True)
    
    logger.info("get_uberon_ontology loading from OWL file")
    ontology = UberonOntology(owl_file_path)
    logger.info("get_uberon_ontology loaded from OWL successfully")
    
    with open(cache_file, 'wb') as f:
        pickle.dump(ontology, f)
    logger.info("get_uberon_ontology saved to cache")
    
    return ontology

def DiseaseOntologyFactory(owl_file_path: str):
    logger.info(f"DiseaseOntologyFactory called with {owl_file_path}")
    return get_disease_ontology(owl_file_path)

def SpeciesOntologyFactory(owl_file_path: str):
    logger.info(f"SpeciesOntologyFactory called with {owl_file_path}")
    return get_species_ontology(owl_file_path)

def CellOntologyFactory(owl_file_path: str):
    logger.info(f"CellOntologyFactory called with {owl_file_path}")
    return get_cell_ontology(owl_file_path)

def UberonOntologyFactory(owl_file_path: str):
    logger.info(f"UberonOntologyFactory called with {owl_file_path}")
    return get_uberon_ontology(owl_file_path)