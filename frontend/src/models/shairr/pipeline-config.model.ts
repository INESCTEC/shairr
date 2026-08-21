export interface PipelineConfigModel {
    id: number;
    id_pipeline: number;
    id_workspace: number;
    context?: string;
    config_json?: any;
    created_at?: string;
    updated_at?: string;
}

export interface PipelineConfigCreateModel {
    id_pipeline: number;
    id_workspace: number;
    context?: string;
    config_json?: any;
}

export interface PipelineConfigUpdateModel {
    context?: string;
    config_json?: any;
}