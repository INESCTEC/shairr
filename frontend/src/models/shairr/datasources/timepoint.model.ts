export interface TimepointModel {
    id: number;
    id_subject: number;
    id_relative_time_point?: number | null;
    units_of_measurement: string;
    time_point: number;
    description: string;
}