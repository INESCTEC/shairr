import rdflib
from rdflib import URIRef, Literal
from rdflib.namespace import RDF, RDFS, OWL
from typing import List, Dict, Optional, Set
import re
from pathlib import Path

class DiseaseOntology:
    def __init__(self, owl_file_path: str):
        # Only run heavy initialization if we're not being unpickled
        if hasattr(self, '_initialized') and self._initialized:
            return
            
        self.graph = rdflib.Graph()
        
        if not Path(owl_file_path).exists():
            self.graph = rdflib.Graph()
        else:
            try:
                self.graph.parse(owl_file_path, format='xml')
            except Exception as e:
                self.graph = rdflib.Graph()
        
        self.terms: Dict[str, Dict] = {}
        self.label_to_id: Dict[str, str] = {}
        self.id_to_label: Dict[str, str] = {}
        
        if self.graph:
            self.load_terms()
            self.build_hierarchy()
        else:
            print("No terms loaded. Using empty ontology instead...")
        
        self._initialized = True
        self._owl_file_path = owl_file_path
    
    def __getstate__(self):
        """Called when pickling - save only the data, not the graph"""
        state = self.__dict__.copy()
        # Remove the graph as it might not pickle well
        if 'graph' in state:
            del state['graph']
        return state
    
    def __setstate__(self, state):
        """Called when unpickling - restore without reinitializing"""
        self.__dict__.update(state)
        # Restore the graph as empty (or reload if needed)
        self.graph = rdflib.Graph()
        self._initialized = True
    
    def load_terms(self):
        """Extract disease terms from OWL file"""
        
        # Define common namespaces
        OBO = rdflib.Namespace("http://purl.obolibrary.org/obo/")
        
        # Query for all classes with labels - FIXED: using 'cls' instead of 'class'
        query = """
        SELECT ?cls ?label ?synonym ?definition ?parent
        WHERE {
            ?cls a owl:Class .
            OPTIONAL { ?cls rdfs:label ?label . }
            OPTIONAL { ?cls <http://www.geneontology.org/formats/oboInOwl#hasExactSynonym> ?synonym . }
            OPTIONAL { ?cls <http://purl.obolibrary.org/obo/IAO_0000115> ?definition . }
            OPTIONAL {
                ?cls rdfs:subClassOf ?parent .
                FILTER(?parent != owl:Thing)
            }
        }
        """
        
        results = list(self.graph.query(query))
        
        for row in results:
            cls_uri = str(row.cls)  # Changed from row.class to row.cls
            label = str(row.label) if row.label else cls_uri.split("#")[-1] if "#" in cls_uri else cls_uri.split("/")[-1]
            
            # Extract DOID from URI
            doid = None
            if "DOID_" in cls_uri:
                match = re.search(r'DOID_(\d+)', cls_uri)
                if match:
                    doid = f"DOID:{match.group(1)}"
            elif "DOID:" in cls_uri:
                # Handle DOID in other formats
                match = re.search(r'(DOID:\d+)', cls_uri)
                if match:
                    doid = match.group(1)
            else:
                # Use the last part of the URI as ID
                doid = cls_uri.split("#")[-1] if "#" in cls_uri else cls_uri.split("/")[-1]
                # Clean up the ID
                doid = doid.replace("_", ":")
            
            if not doid:
                continue
                
            # Initialize term if not exists
            if doid not in self.terms:
                self.terms[doid] = {
                    "id": doid,
                    "label": label,
                    "synonyms": [],
                    "definition": None,
                    "parents": [],
                    "children": [],
                    "ancestors": [],
                    "descendants": []
                }
                self.label_to_id[label.lower()] = doid
                self.id_to_label[doid] = label
            
            # Add synonym if exists
            if row.synonym:
                syn = str(row.synonym)
                if syn not in self.terms[doid]["synonyms"]:
                    self.terms[doid]["synonyms"].append(syn)
            
            # Add definition if exists
            if row.definition and not self.terms[doid]["definition"]:
                self.terms[doid]["definition"] = str(row.definition)
            
            # Add parent if exists
            if row.parent:
                parent_uri = str(row.parent)
                parent_doid = None
                
                if "DOID_" in parent_uri:
                    match = re.search(r'DOID_(\d+)', parent_uri)
                    if match:
                        parent_doid = f"DOID:{match.group(1)}"
                elif "DOID:" in parent_uri:
                    match = re.search(r'(DOID:\d+)', parent_uri)
                    if match:
                        parent_doid = match.group(1)
                else:
                    parent_doid = parent_uri.split("#")[-1] if "#" in parent_uri else parent_uri.split("/")[-1]
                    parent_doid = parent_doid.replace("_", ":")
                
                if parent_doid and parent_doid not in self.terms[doid]["parents"]:
                    self.terms[doid]["parents"].append(parent_doid)
        
        # If no terms were loaded, add some dummy data for testing
        if len(self.terms) == 0:
            self.terms = {
                "DOID:0050844": {
                    "id": "DOID:0050844",
                    "label": "spasmodic dystonia",
                    "synonyms": ["spasmodic dysphonia"],
                    "definition": "A focal dystonia that is characterized by involuntary movements or spasms of one or more muscles of the larynx during voluntary speech production.",
                    "parents": ["DOID:0060041"],
                    "children": [],
                    "ancestors": ["DOID:0060041", "DOID:4"],
                    "descendants": []
                },
                "DOID:0060041": {
                    "id": "DOID:0060041",
                    "label": "focal dystonia",
                    "synonyms": [],
                    "definition": "A dystonia that is characterized by sustained muscle contractions, which often cause twisting and repetitive movements or abnormal postures in a single body region.",
                    "parents": ["DOID:0060039"],
                    "children": ["DOID:0050844"],
                    "ancestors": ["DOID:0060039", "DOID:4"],
                    "descendants": ["DOID:0050844"]
                },
                "DOID:4": {
                    "id": "DOID:4",
                    "label": "disease",
                    "synonyms": [],
                    "definition": "A disorder of structure or function in a human, animal, or plant, especially one that produces specific signs or symptoms.",
                    "parents": [],
                    "children": ["DOID:0060039"],
                    "ancestors": [],
                    "descendants": ["DOID:0060039", "DOID:0060041", "DOID:0050844"]
                }
            }
            
            # Update label mappings
            for doid, term in self.terms.items():
                self.label_to_id[term["label"].lower()] = doid
                self.id_to_label[doid] = term["label"]
    
    def build_hierarchy(self):
        """Build ancestor/descendant relationships"""
        
        # First build children from parents
        for doid, term in self.terms.items():
            for parent in term["parents"]:
                if parent in self.terms:
                    if doid not in self.terms[parent]["children"]:
                        self.terms[parent]["children"].append(doid)
        
        # Then build ancestors and descendants
        for doid in self.terms:
            self.terms[doid]["ancestors"] = self._get_ancestors(doid, set())
            self.terms[doid]["descendants"] = self._get_descendants(doid, set())
    
    def _get_ancestors(self, doid: str, visited: Set[str]) -> List[str]:
        """Recursively get all ancestors"""
        if doid not in self.terms or doid in visited:
            return []
        
        visited.add(doid)
        ancestors = []
        
        for parent in self.terms[doid].get("parents", []):
            if parent in self.terms:
                ancestors.append(parent)
                # Recursively get ancestors of parent
                parent_ancestors = self._get_ancestors(parent, visited.copy())
                for ancestor in parent_ancestors:
                    if ancestor not in ancestors:
                        ancestors.append(ancestor)
        
        return ancestors
    
    def _get_descendants(self, doid: str, visited: Set[str]) -> List[str]:
        """Recursively get all descendants"""
        if doid not in self.terms or doid in visited:
            return []
        
        visited.add(doid)
        descendants = []
        
        for child in self.terms[doid].get("children", []):
            if child in self.terms:
                descendants.append(child)
                # Recursively get descendants of child
                child_descendants = self._get_descendants(child, visited.copy())
                for descendant in child_descendants:
                    if descendant not in descendants:
                        descendants.append(descendant)
        
        return descendants
    
    def search(self, query: str, limit: int = 20) -> List[Dict]:
        """Search for terms by label, synonym, or DOID"""
        if not query:
            return []
        
        query_lower = query.lower()
        results = []
        
        for doid, term in self.terms.items():
            # Check label
            if query_lower in term["label"].lower():
                results.append(term)
            # Check DOID
            elif query_lower in doid.lower():
                results.append(term)
            # Check synonyms
            elif any(query_lower in syn.lower() for syn in term["synonyms"]):
                results.append(term)
            
            if len(results) >= limit:
                break
        
        # Sort by relevance (exact DOID match first, then label match)
        def sort_key(term):
            if query_lower == term["id"].lower():
                return 0
            elif query_lower in term["label"].lower():
                return 1
            else:
                return 2
        
        results.sort(key=sort_key)
        
        return results
    
    def get_term(self, doid: str) -> Optional[Dict]:
        """Get a specific term by DOID"""
        return self.terms.get(doid)
    
    def get_term_by_label(self, label: str) -> Optional[Dict]:
        """Get a term by its label"""
        doid = self.label_to_id.get(label.lower())
        if doid:
            return self.terms.get(doid)
        return None
    
    def get_all_terms(self, skip: int = 0, limit: int = 100) -> List[Dict]:
        """Get paginated list of all terms"""
        items = list(self.terms.values())
        
        # Sort by DOID for consistent ordering
        items.sort(key=lambda x: x["id"])
        
        return items[skip:skip + limit]
    
    def get_total_count(self) -> int:
        """Get total number of terms"""
        return len(self.terms)