export interface CellTerm {
    id: string;
    label: string;
    synonyms: string[];
    definition: string | null;
    parents: string[];
    children: string[];
    ancestors: string[];
    descendants: string[];
}