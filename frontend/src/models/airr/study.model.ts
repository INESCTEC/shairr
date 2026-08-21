import { OntologyModel } from "./ontology.model";

export interface StudyModel {
    study_id: string;
    study_title: string;
    study_type: OntologyModel;
    inclusion_exclusion_criteria: string;
    keywords_study?: string[];
    study_description?: string;
    adc_publish_date: string;
    pub_ids: string;
    collected_by?: string;
    lab_name?: string;
    lab_address?: string;
    submitted_by?: string;
    grants?: string;
    adc_update_date: string;
}
