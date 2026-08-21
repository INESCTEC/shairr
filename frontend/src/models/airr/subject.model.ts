import { OntologyModel } from './ontology.model';

export interface SubjectModel {
    subject_id: string;
    synthetic: boolean;
    species: OntologyModel;
    immunogen: string;
    sex: string;
    age_min?: number;
    age_max?: number;
    age_unit?: OntologyModel;
    age_event?: string;
    ancestry_population?: string;
    genotype?: GenotypeModel;
    diagnosis: DiagnosisModel[];
    ethnicity?: string;
    race?: string;
    strain_name?: string;
    linked_subjects?: string[];
    link_type?: string;
}

export interface DiagnosisModel {
    disease_stage: string;
    study_group_description: string;
    disease_diagnosis: OntologyModel;
    disease_length: number | null;
    prior_therapies: string | null;
    immunogen: string | null;
    intervention: string | null;
    medical_history: string | null;
}

export interface GenotypeModel {
    mhc_genotype_list: string[];
    name?: string;
    mhc_class?: string;
}
