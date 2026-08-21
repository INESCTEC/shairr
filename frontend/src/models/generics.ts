export type IndexedById<T> = { [key: number]: T }

export type PickleType = { [key: string]: number | null[] };

export interface DownloadStatus {
    downloading: boolean;
    number_done: number;
    total: number;
    errors: Error[];
}