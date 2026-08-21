import { OntologyModel } from "../../airr/ontology.model";

export interface SampleModel {
    id: number;
    id_subject: number;
    id_study: number;
    id_timepoint: number | null;
    sample_id: string;
    sample_type: string | null;
    tissue: OntologyModel | null;
    cell_subset: OntologyModel | null;
    cell_phenotype: string | null;
    sequencing_type: string;
}