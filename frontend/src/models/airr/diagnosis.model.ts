import { OntologyModel } from "./ontology.model";

export interface DiagnosisModel {
    id: number;
    disease_diagnosis: string;
    disease_stage: string;
    immunogen: string;
    id_subject: number;
}