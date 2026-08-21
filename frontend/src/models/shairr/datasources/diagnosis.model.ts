import { OntologyModel } from "../../airr/ontology.model";


export interface DiagnosisModel {
    id: number;
    disease_stage: string;
    immunogen?: string;
    disease_diagnosis: OntologyModel;
    id_subject?: number;
}