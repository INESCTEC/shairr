interface ApiModel {
    title?: string;
    version?: string;
}

export interface InfoModel {
    version?: string;
    title?: string;
    name?: string;
    api?: ApiModel;
}