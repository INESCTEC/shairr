import { DatasetModel } from "./dataset.model";

export interface DatasetGroupModel {
    id: number;
    name: string;
    datasets: DatasetModel[]
}