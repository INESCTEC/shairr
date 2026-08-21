import { ActionModel } from './action.model';

export interface PipelineStepModel {
    id: number;
    id_pipeline: number;
    id_next_step?: number;

    x: number;
    y: number;

    action: ActionModel;
}
