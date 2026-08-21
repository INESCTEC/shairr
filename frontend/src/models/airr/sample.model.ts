import { DatasetModel } from "../shairr/dataset.model";
import { OntologyModel } from "./ontology.model";

export interface SampleModel {
    id: number;
    sample_id: string;
    annotated: boolean;
    sample_type: string;
    tissue: OntologyModel;
    cell_subset: OntologyModel;
    anatomic_site: string;
    biomaterial_provider: string;
    cell_storage: boolean;
    disease_state_sample: string;
    cell_phenotype: string;
    pcr_target: PcrTarget[];
    collection_time_point_relative: number;
    collection_time_point_unit: OntologyModel;
    collection_time_point_reference: string;
    sample_processing_id?: string; 
    sequencing_type?: string;
    rearrangements?: DatasetModel[];
}

export interface PcrTarget {
    pcr_target_locus?: string;

}