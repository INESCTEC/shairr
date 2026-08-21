export interface AlleleModel {
    class: string;
    species: string;
    accession: string;
    name: string;
    status?: string;
    id?: string; 
}

export interface MetaModel {
    next: string;
    prev?: string;
    sort?: string;
    total: number
}

export interface EbiResponseModel {
    data: AlleleModel[];
    meta: MetaModel;
}