export interface DiseaseTerm {
  id: string;
  label: string;
  synonyms: string[];
  definition?: string;
  parents: string[];
  children: string[];
  ancestors: string[];
  descendants: string[];
}

export interface SearchResult {
  query: string;
  results: DiseaseTerm[];
  total: number;
}