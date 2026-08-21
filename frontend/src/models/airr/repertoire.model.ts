import { DataProcessingModel } from './data-processing.model';
import { SampleModel } from './sample.model';
import { StudyModel } from './study.model';
import { SubjectModel } from './subject.model';

export interface RepertoireModel {
    id: number;
    repertoire_id: string;
    repertoire_name?: string;
    repertoire_description?: string;
    study: StudyModel;
    subject: SubjectModel;
    subject_id?: number;
    data_processing: DataProcessingModel[];
    sample?: SampleModel[];
    id_workspace?: number;
}