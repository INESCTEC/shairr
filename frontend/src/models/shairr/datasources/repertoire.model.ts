import { SampleModel } from './sample.model';
import { StudyModel } from './study.model';
import { SubjectModel } from './subject.model';

export interface RepertoireModel {
    id: number;

    study: StudyModel;
    subject: SubjectModel;
    sample?: SampleModel[];
}