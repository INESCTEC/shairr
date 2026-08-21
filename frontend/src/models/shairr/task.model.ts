import { ActionModel } from "./action.model";
import { DatasetModel } from "./dataset.model";
import { PipelineConfigModel } from "./pipeline-config.model";
import { PipelineStepModel } from "./pipeline-steps.model";

export interface TaskInput {
    parameters: { [key: string]: any };
    datasets: { [key: string]: number };
}

export interface TaskModel {
    id: number;
    name: string;

    pipeline_step: PipelineStepModel;

    id_pipeline: number;
    id_process: number;
    output_path: string;
    status: string;
    time_start: Date;
    time_end: Date;
    datasets?: DatasetModel[];
    pipeline_config?: PipelineConfigModel;

    action?: ActionModel;
}