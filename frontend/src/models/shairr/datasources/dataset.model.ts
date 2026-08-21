export interface DatasetModel {
    id: number;
    id_group: number;
    filename: string;
    filesize: number;
    line_count: number;
    time_created: string;
    annotated: boolean;
}