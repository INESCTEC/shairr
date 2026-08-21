export interface SpeciesTerm {
  id: string;
  label: string;
  synonyms: string[];
  rank?: string; 
  common_name?: string;
  parents: string[];
  children: string[];
}

export interface SpeciesSearchResult {
  query: string;
  results: SpeciesTerm[];
  total: number;
}

export interface SpeciesSearchQuery {
  query: string;
  limit?: number;
}