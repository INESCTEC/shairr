# Uberon.py
import rdflib
from rdflib import URIRef, Literal
from rdflib.namespace import RDF, RDFS, OWL
from typing import List, Dict, Optional, Set
import re
from pathlib import Path

class UberonOntology:
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
        """Extract Uberon terms from OWL file"""
        
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
            
            # Extract UBERON ID from URI
            uberon_id = None
            if "UBERON_" in cls_uri:
                match = re.search(r'UBERON_(\d+)', cls_uri)
                if match:
                    uberon_id = f"UBERON:{match.group(1)}"
            elif "UBERON:" in cls_uri:
                # Handle UBERON in other formats
                match = re.search(r'(UBERON:\d+)', cls_uri)
                if match:
                    uberon_id = match.group(1)
            else:
                # Use the last part of the URI as ID
                uberon_id = cls_uri.split("#")[-1] if "#" in cls_uri else cls_uri.split("/")[-1]
                # Clean up the ID
                uberon_id = uberon_id.replace("_", ":")
            
            if not uberon_id:
                continue
                
            # Initialize term if not exists
            if uberon_id not in self.terms:
                self.terms[uberon_id] = {
                    "id": uberon_id,
                    "label": label,
                    "synonyms": [],
                    "definition": None,
                    "parents": [],
                    "children": [],
                    "ancestors": [],
                    "descendants": []
                }
                self.label_to_id[label.lower()] = uberon_id
                self.id_to_label[uberon_id] = label
            
            # Add synonym if exists
            if row.synonym:
                syn = str(row.synonym)
                if syn not in self.terms[uberon_id]["synonyms"]:
                    self.terms[uberon_id]["synonyms"].append(syn)
            
            # Add definition if exists
            if row.definition and not self.terms[uberon_id]["definition"]:
                self.terms[uberon_id]["definition"] = str(row.definition)
            
            # Add parent if exists
            if row.parent:
                parent_uri = str(row.parent)
                parent_uberon_id = None
                
                if "UBERON_" in parent_uri:
                    match = re.search(r'UBERON_(\d+)', parent_uri)
                    if match:
                        parent_uberon_id = f"UBERON:{match.group(1)}"
                elif "UBERON:" in parent_uri:
                    match = re.search(r'(UBERON:\d+)', parent_uri)
                    if match:
                        parent_uberon_id = match.group(1)
                else:
                    parent_uberon_id = parent_uri.split("#")[-1] if "#" in parent_uri else parent_uri.split("/")[-1]
                    parent_uberon_id = parent_uberon_id.replace("_", ":")
                
                if parent_uberon_id and parent_uberon_id not in self.terms[uberon_id]["parents"]:
                    self.terms[uberon_id]["parents"].append(parent_uberon_id)
        
        # If no terms were loaded, add some dummy data for testing
        if len(self.terms) == 0:
            self.terms = {
                "UBERON:0000029": {
                    "id": "UBERON:0000029",
                    "label": "lymph node",
                    "synonyms": [],
                    "definition": "A secondary lymphoid organ that filters lymph and facilitates immune responses.",
                    "parents": ["UBERON:0005057"],
                    "children": [],
                    "ancestors": ["UBERON:0005057", "UBERON:0002405"],
                    "descendants": []
                },
                "UBERON:0005057": {
                    "id": "UBERON:0005057",
                    "label": "immune organ",
                    "synonyms": [],
                    "definition": "An organ that participates in immune system function.",
                    "parents": ["UBERON:0002405"],
                    "children": ["UBERON:0000029"],
                    "ancestors": ["UBERON:0002405"],
                    "descendants": ["UBERON:0000029"]
                },
                "UBERON:0002405": {
                    "id": "UBERON:0002405",
                    "label": "immune system",
                    "synonyms": [],
                    "definition": "An anatomical system responsible for immune responses and host defense.",
                    "parents": [],
                    "children": ["UBERON:0005057"],
                    "ancestors": [],
                    "descendants": ["UBERON:0005057", "UBERON:0000029"]
                }
            }
            
            # Update label mappings
            for uberon_id, term in self.terms.items():
                self.label_to_id[term["label"].lower()] = uberon_id
                self.id_to_label[uberon_id] = term["label"]
    
    def build_hierarchy(self):
        """Build ancestor/descendant relationships"""
        
        # First build children from parents
        for uberon_id, term in self.terms.items():
            for parent in term["parents"]:
                if parent in self.terms:
                    if uberon_id not in self.terms[parent]["children"]:
                        self.terms[parent]["children"].append(uberon_id)
        
        # Then build ancestors and descendants
        for uberon_id in self.terms:
            self.terms[uberon_id]["ancestors"] = self._get_ancestors(uberon_id, set())
            self.terms[uberon_id]["descendants"] = self._get_descendants(uberon_id, set())
    
    def _get_ancestors(self, uberon_id: str, visited: Set[str]) -> List[str]:
        """Recursively get all ancestors"""
        if uberon_id not in self.terms or uberon_id in visited:
            return []
        
        visited.add(uberon_id)
        ancestors = []
        
        for parent in self.terms[uberon_id].get("parents", []):
            if parent in self.terms:
                ancestors.append(parent)
                # Recursively get ancestors of parent
                parent_ancestors = self._get_ancestors(parent, visited.copy())
                for ancestor in parent_ancestors:
                    if ancestor not in ancestors:
                        ancestors.append(ancestor)
        
        return ancestors
    
    def _get_descendants(self, uberon_id: str, visited: Set[str]) -> List[str]:
        """Recursively get all descendants"""
        if uberon_id not in self.terms or uberon_id in visited:
            return []
        
        visited.add(uberon_id)
        descendants = []
        
        for child in self.terms[uberon_id].get("children", []):
            if child in self.terms:
                descendants.append(child)
                # Recursively get descendants of child
                child_descendants = self._get_descendants(child, visited.copy())
                for descendant in child_descendants:
                    if descendant not in descendants:
                        descendants.append(descendant)
        
        return descendants
    
    def search(self, query: str, limit: int = 20) -> List[Dict]:
        """Search for terms by label, synonym, or UBERON ID"""
        if not query:
            return []
        
        query_lower = query.lower()
        results = []
        
        for uberon_id, term in self.terms.items():
            # Check label
            if query_lower in term["label"].lower():
                results.append(term)
            # Check UBERON ID
            elif query_lower in uberon_id.lower():
                results.append(term)
            # Check synonyms
            elif any(query_lower in syn.lower() for syn in term["synonyms"]):
                results.append(term)
            
            if len(results) >= limit:
                break
        
        # Sort by relevance (exact UBERON ID match first, then label match)
        def sort_key(term):
            if query_lower == term["id"].lower():
                return 0
            elif query_lower in term["label"].lower():
                return 1
            else:
                return 2
        
        results.sort(key=sort_key)
        
        return results
    
    def get_term(self, uberon_id: str) -> Optional[Dict]:
        """Get a specific term by UBERON ID"""
        return self.terms.get(uberon_id)
    
    def get_term_by_label(self, label: str) -> Optional[Dict]:
        """Get a term by its label"""
        uberon_id = self.label_to_id.get(label.lower())
        if uberon_id:
            return self.terms.get(uberon_id)
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