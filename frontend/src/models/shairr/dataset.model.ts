import type { RepertoireModel } from "../airr/repertoire.model";
import { DataType } from './datatype.enum';

export interface DatasetModel {
    id: number;
    id_repertoire?: number;
    filename: string;
    filesize: number;
    time_created: string;
    repertoire?: RepertoireModel;
    type: DataType;
}