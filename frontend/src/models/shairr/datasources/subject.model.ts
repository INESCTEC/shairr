import { SubjectModel as AirrSubjectModel } from 'src/models/airr/subject.model';
import { UtilitiesService } from 'src/services/utilities.service';
import { OntologyModel } from 'src/models/airr/ontology.model'
import { DiagnosisModel } from './diagnosis.model';

export interface SubjectModel {
    id: number;
    id_study: number;
    subject_id: string;
    synthetic: boolean;
    species: OntologyModel;
    diagnosis: DiagnosisModel[];
}

export const mapAirrSubject = UtilitiesService.createAutoMapper<SubjectModel, AirrSubjectModel>({
    transforms: {

    },
    defaults: {
        diagnosis: []
    }
});