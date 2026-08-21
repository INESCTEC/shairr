# Cell.py
import rdflib
from rdflib import URIRef, Literal
from rdflib.namespace import RDF, RDFS, OWL
from typing import List, Dict, Optional, Set
import re
from pathlib import Path

class CellOntology:
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
        """Extract cell terms from OWL file"""
        
        # Query for all classes with labels
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
            cls_uri = str(row.cls)
            label = str(row.label) if row.label else cls_uri.split("#")[-1] if "#" in cls_uri else cls_uri.split("/")[-1]
            
            # Extract CL ID from URI
            cl_id = None
            if "CL_" in cls_uri:
                match = re.search(r'CL_(\d+)', cls_uri)
                if match:
                    cl_id = f"CL:{match.group(1)}"
            elif "CL:" in cls_uri:
                # Handle CL in other formats
                match = re.search(r'(CL:\d+)', cls_uri)
                if match:
                    cl_id = match.group(1)
            else:
                # Use the last part of the URI as ID
                cl_id = cls_uri.split("#")[-1] if "#" in cls_uri else cls_uri.split("/")[-1]
                # Clean up the ID
                cl_id = cl_id.replace("_", ":")
            
            if not cl_id:
                continue
                
            # Initialize term if not exists
            if cl_id not in self.terms:
                self.terms[cl_id] = {
                    "id": cl_id,
                    "label": label,
                    "synonyms": [],
                    "definition": None,
                    "parents": [],
                    "children": [],
                    "ancestors": [],
                    "descendants": []
                }
                self.label_to_id[label.lower()] = cl_id
                self.id_to_label[cl_id] = label
            
            # Add synonym if exists
            if row.synonym:
                syn = str(row.synonym)
                if syn not in self.terms[cl_id]["synonyms"]:
                    self.terms[cl_id]["synonyms"].append(syn)
            
            # Add definition if exists
            if row.definition and not self.terms[cl_id]["definition"]:
                self.terms[cl_id]["definition"] = str(row.definition)
            
            # Add parent if exists
            if row.parent:
                parent_uri = str(row.parent)
                parent_cl_id = None
                
                if "CL_" in parent_uri:
                    match = re.search(r'CL_(\d+)', parent_uri)
                    if match:
                        parent_cl_id = f"CL:{match.group(1)}"
                elif "CL:" in parent_uri:
                    match = re.search(r'(CL:\d+)', parent_uri)
                    if match:
                        parent_cl_id = match.group(1)
                else:
                    parent_cl_id = parent_uri.split("#")[-1] if "#" in parent_uri else parent_uri.split("/")[-1]
                    parent_cl_id = parent_cl_id.replace("_", ":")
                
                if parent_cl_id and parent_cl_id not in self.terms[cl_id]["parents"]:
                    self.terms[cl_id]["parents"].append(parent_cl_id)
        
        # If no terms were loaded, add some dummy data for testing
        if len(self.terms) == 0:
            self.terms = {
                "CL:0000540": {
                    "id": "CL:0000540",
                    "label": "neuron",
                    "synonyms": ["nerve cell"],
                    "definition": "The basic cellular unit of nervous tissue. Each neuron consists of a body, an axon, and dendrites. Their purpose is to receive, conduct, and transmit impulses in the nervous system.",
                    "parents": ["CL:0002319"],
                    "children": ["CL:0000541", "CL:0000598"],
                    "ancestors": ["CL:0002319", "CL:0000003"],
                    "descendants": ["CL:0000541", "CL:0000598"]
                },
                "CL:0002319": {
                    "id": "CL:0002319",
                    "label": "neural cell",
                    "synonyms": [],
                    "definition": "A cell of the nervous system.",
                    "parents": ["CL:0000003"],
                    "children": ["CL:0000540"],
                    "ancestors": ["CL:0000003"],
                    "descendants": ["CL:0000540", "CL:0000541", "CL:0000598"]
                },
                "CL:0000003": {
                    "id": "CL:0000003",
                    "label": "native cell",
                    "synonyms": [],
                    "definition": "A cell that is found in a natural setting, which includes multicellular organism cells 'in vivo' (i.e. part of an organism), and microbial cells in their natural habitat (e.g. biofilm, host).",
                    "parents": [],
                    "children": ["CL:0002319"],
                    "ancestors": [],
                    "descendants": ["CL:0002319", "CL:0000540", "CL:0000541", "CL:0000598"]
                }
            }
            
            # Update label mappings
            for cl_id, term in self.terms.items():
                self.label_to_id[term["label"].lower()] = cl_id
                self.id_to_label[cl_id] = term["label"]
    
    def build_hierarchy(self):
        """Build ancestor/descendant relationships"""
        
        # First build children from parents
        for cl_id, term in self.terms.items():
            for parent in term["parents"]:
                if parent in self.terms:
                    if cl_id not in self.terms[parent]["children"]:
                        self.terms[parent]["children"].append(cl_id)
        
        # Then build ancestors and descendants
        for cl_id in self.terms:
            self.terms[cl_id]["ancestors"] = self._get_ancestors(cl_id, set())
            self.terms[cl_id]["descendants"] = self._get_descendants(cl_id, set())
    
    def _get_ancestors(self, cl_id: str, visited: Set[str]) -> List[str]:
        """Recursively get all ancestors"""
        if cl_id not in self.terms or cl_id in visited:
            return []
        
        visited.add(cl_id)
        ancestors = []
        
        for parent in self.terms[cl_id].get("parents", []):
            if parent in self.terms:
                ancestors.append(parent)
                # Recursively get ancestors of parent
                parent_ancestors = self._get_ancestors(parent, visited.copy())
                for ancestor in parent_ancestors:
                    if ancestor not in ancestors:
                        ancestors.append(ancestor)
        
        return ancestors
    
    def _get_descendants(self, cl_id: str, visited: Set[str]) -> List[str]:
        """Recursively get all descendants"""
        if cl_id not in self.terms or cl_id in visited:
            return []
        
        visited.add(cl_id)
        descendants = []
        
        for child in self.terms[cl_id].get("children", []):
            if child in self.terms:
                descendants.append(child)
                # Recursively get descendants of child
                child_descendants = self._get_descendants(child, visited.copy())
                for descendant in child_descendants:
                    if descendant not in descendants:
                        descendants.append(descendant)
        
        return descendants
    
    def search(self, query: str, limit: int = 20) -> List[Dict]:
        """Search for terms by label, synonym, or CL ID"""
        if not query:
            return []
        
        query_lower = query.lower()
        results = []
        
        for cl_id, term in self.terms.items():
            # Check label
            if query_lower in term["label"].lower():
                results.append(term)
            # Check CL ID
            elif query_lower in cl_id.lower():
                results.append(term)
            # Check synonyms
            elif any(query_lower in syn.lower() for syn in term["synonyms"]):
                results.append(term)
            
            if len(results) >= limit:
                break
        
        # Sort by relevance (exact CL ID match first, then label match)
        def sort_key(term):
            if query_lower == term["id"].lower():
                return 0
            elif query_lower in term["label"].lower():
                return 1
            else:
                return 2
        
        results.sort(key=sort_key)
        
        return results
    
    def get_term(self, cl_id: str) -> Optional[Dict]:
        """Get a specific term by CL ID"""
        return self.terms.get(cl_id)
    
    def get_term_by_label(self, label: str) -> Optional[Dict]:
        """Get a term by its label"""
        cl_id = self.label_to_id.get(label.lower())
        if cl_id:
            return self.terms.get(cl_id)
        return None
    
    def get_all_terms(self, skip: int = 0, limit: int = 100) -> List[Dict]:
        """Get paginated list of all terms"""
        items = list(self.terms.values())
        
        # Sort by ID for consistent ordering
        items.sort(key=lambda x: x["id"])
        
        return items[skip:skip + limit]
    
    def get_total_count(self) -> int:
        """Get total number of terms"""
        return len(self.terms)