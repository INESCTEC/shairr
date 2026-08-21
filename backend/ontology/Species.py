# ontology/Species.py
import rdflib
from rdflib import URIRef, Literal
from rdflib.namespace import RDF, RDFS, OWL
from typing import List, Dict, Optional, Set
import re
from pathlib import Path

class SpeciesOntology:
    def __init__(self, owl_file_path: str):
        # Only run heavy initialization if we're not being unpickled
        if hasattr(self, '_initialized') and self._initialized:
            return
            
        self.graph = rdflib.Graph()
        self.terms: Dict[str, Dict] = {}
        self.label_to_id: Dict[str, str] = {}
        
        if Path(owl_file_path).exists():
            try:
                self.graph.parse(owl_file_path, format='xml')
                self.load_terms()
                self.build_hierarchy()
            except Exception as e:
                self.load_dummy_data()
        else:
            self.load_dummy_data()
        
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

    def get_common_species(self) -> List[Dict]:
        """Return a list of common laboratory species"""
        common_taxids = [
            "NCBITaxon:9606",   # human
            "NCBITaxon:10090",  # mouse
            "NCBITaxon:10116",  # rat
            "NCBITaxon:7955",   # zebrafish
            "NCBITaxon:7227",   # fruit fly
            "NCBITaxon:6239",   # c. elegans
            "NCBITaxon:9913",   # cow
            "NCBITaxon:9823",   # pig
            "NCBITaxon:9615",   # dog
            "NCBITaxon:9685",   # cat
            "NCBITaxon:9544",   # macaque
            "NCBITaxon:9598",   # chimpanzee
            "NCBITaxon:9031",   # chicken
            "NCBITaxon:8364",   # xenopus
            "NCBITaxon:4932",   # yeast
            "NCBITaxon:562",    # e. coli
        ]
        
        results = []
        for taxid in common_taxids:
            if taxid in self.terms:
                results.append(self.terms[taxid])
        return results
    
    def load_terms(self):
        query = """
        PREFIX obo: <http://purl.obolibrary.org/obo/>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX ncbitaxon: <http://purl.obolibrary.org/obo/NCBITaxon_>
        
        SELECT DISTINCT ?term ?label ?synonym ?rank ?common ?parent
        WHERE {
            ?term a owl:Class .
            ?term rdfs:label ?label .
            OPTIONAL { ?term obo:NCBITaxon_has_rank ?rank . }
            OPTIONAL { ?term obo:NCBITaxon_common_name ?common . }
            OPTIONAL { ?term <http://www.geneontology.org/formats/oboInOwl#hasExactSynonym> ?synonym . }
            OPTIONAL {
                ?term rdfs:subClassOf ?parent .
                FILTER(?parent != owl:Thing)
                FILTER(CONTAINS(STR(?parent), "NCBITaxon"))
            }
            FILTER(CONTAINS(STR(?term), "NCBITaxon"))
        }
        """
        
        try:
            results = self.graph.query(query)
            
            for row in results:
                term_uri = str(row.term)
                taxid_match = re.search(r'NCBITaxon_(\d+)', term_uri)
                if not taxid_match:
                    continue
                    
                taxid = f"NCBITaxon:{taxid_match.group(1)}"
                label = str(row.label)
                
                if taxid not in self.terms:
                    self.terms[taxid] = {
                        "id": taxid,
                        "label": label,
                        "synonyms": [],
                        "rank": None,
                        "common_name": None,
                        "parents": [],
                        "children": [],
                        "ancestors": [],
                        "descendants": []
                    }
                    self.label_to_id[label.lower()] = taxid
                
                if row.synonym:
                    syn = str(row.synonym)
                    if syn not in self.terms[taxid]["synonyms"]:
                        self.terms[taxid]["synonyms"].append(syn)
                
                if row.rank:
                    rank_uri = str(row.rank)
                    rank_match = re.search(r'NCBITaxon_(\w+)$', rank_uri)
                    if rank_match:
                        self.terms[taxid]["rank"] = rank_match.group(1).replace('_', ' ')
                
                if row.common:
                    self.terms[taxid]["common_name"] = str(row.common)
                
                if row.parent:
                    parent_uri = str(row.parent)
                    parent_match = re.search(r'NCBITaxon_(\d+)', parent_uri)
                    if parent_match:
                        parent_taxid = f"NCBITaxon:{parent_match.group(1)}"
                        if parent_taxid not in self.terms[taxid]["parents"]:
                            self.terms[taxid]["parents"].append(parent_taxid)
        except Exception as e:
            print(f"Error querying NCBITaxon: {e}")
            self.load_dummy_data()
    
    def load_dummy_data(self):
        self.terms = {
            "NCBITaxon:9606": {
                "id": "NCBITaxon:9606",
                "label": "Homo sapiens",
                "synonyms": ["Human"],
                "rank": "species",
                "common_name": "human",
                "parents": ["NCBITaxon:9605"],
                "children": [],
                "ancestors": [],
                "descendants": []
            },
            "NCBITaxon:10090": {
                "id": "NCBITaxon:10090",
                "label": "Mus musculus",
                "synonyms": ["Mouse", "House mouse"],
                "rank": "species",
                "common_name": "mouse",
                "parents": ["NCBITaxon:10088"],
                "children": [],
                "ancestors": [],
                "descendants": []
            },
            "NCBITaxon:10116": {
                "id": "NCBITaxon:10116",
                "label": "Rattus norvegicus",
                "synonyms": ["Rat", "Brown rat"],
                "rank": "species",
                "common_name": "rat",
                "parents": ["NCBITaxon:10114"],
                "children": [],
                "ancestors": [],
                "descendants": []
            }
        }
        
        for taxid, term in self.terms.items():
            self.label_to_id[term["label"].lower()] = taxid
            for syn in term["synonyms"]:
                self.label_to_id[syn.lower()] = taxid
    
    def build_hierarchy(self):
        for taxid, term in self.terms.items():
            for parent in term["parents"]:
                if parent in self.terms:
                    if taxid not in self.terms[parent]["children"]:
                        self.terms[parent]["children"].append(taxid)
        
        for taxid in self.terms:
            self.terms[taxid]["ancestors"] = self._get_ancestors(taxid, set())
            self.terms[taxid]["descendants"] = self._get_descendants(taxid, set())
    
    def _get_ancestors(self, taxid: str, visited: set) -> List[str]:
        if taxid not in self.terms or taxid in visited:
            return []
        visited.add(taxid)
        ancestors = []
        for parent in self.terms[taxid].get("parents", []):
            if parent in self.terms:
                ancestors.append(parent)
                ancestors.extend(self._get_ancestors(parent, visited.copy()))
        return list(set(ancestors))
    
    def _get_descendants(self, taxid: str, visited: set) -> List[str]:
        if taxid not in self.terms or taxid in visited:
            return []
        visited.add(taxid)
        descendants = []
        for child in self.terms[taxid].get("children", []):
            if child in self.terms:
                descendants.append(child)
                descendants.extend(self._get_descendants(child, visited.copy()))
        return list(set(descendants))
    
    def search(self, query: str, limit: int = 20) -> List[Dict]:
        if not query:
            return []
        query_lower = query.lower()
        results = []
        
        for taxid, term in self.terms.items():
            if query_lower in term["label"].lower():
                results.append(term)
            elif query_lower in taxid.lower():
                results.append(term)
            elif term.get("common_name") and query_lower in term["common_name"].lower():
                results.append(term)
            elif any(query_lower in syn.lower() for syn in term["synonyms"]):
                results.append(term)
            
            if len(results) >= limit:
                break
        
        return results[:limit]
    
    def get_term(self, taxid: str) -> Optional[Dict]:
        if not taxid.startswith("NCBITaxon:"):
            taxid = f"NCBITaxon:{taxid}"
        return self.terms.get(taxid)
    
    def get_term_by_label(self, label: str) -> Optional[Dict]:
        taxid = self.label_to_id.get(label.lower())
        if taxid:
            return self.terms.get(taxid)
        return None
    
    def get_common_species(self) -> List[Dict]:
        common_taxids = [
            "NCBITaxon:9606",   # human
            "NCBITaxon:10090",  # mouse
            "NCBITaxon:10116",  # rat
            "NCBITaxon:7955",   # zebrafish
            "NCBITaxon:7227",   # fruit fly
            "NCBITaxon:6239",   # c. elegans
            "NCBITaxon:9913",   # cow
            "NCBITaxon:9823",   # pig
            "NCBITaxon:9615",   # dog
            "NCBITaxon:9685",   # cat
            "NCBITaxon:9544",   # macaque
            "NCBITaxon:9598",   # chimpanzee
            "NCBITaxon:9031",   # chicken
            "NCBITaxon:8364",   # xenopus
            "NCBITaxon:4932",   # yeast
            "NCBITaxon:562",    # e. coli
        ]
        
        results = []
        for taxid in common_taxids:
            if taxid in self.terms:
                results.append(self.terms[taxid])
        return results
    
    def get_all_terms(self, skip: int = 0, limit: int = 100) -> List[Dict]:
        items = list(self.terms.values())
        items.sort(key=lambda x: x["label"])
        return items[skip:skip + limit]
    
    def get_total_count(self) -> int:
        return len(self.terms)