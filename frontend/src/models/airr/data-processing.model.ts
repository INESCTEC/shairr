export interface DataProcessingModel {
    data_processing_id: string;
    primary_annotation: boolean;
    software_versions: string;
    germline_database: string;
    data_processing_files: string[];
    analysis_provenance_id: string;
}