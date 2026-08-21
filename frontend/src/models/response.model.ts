/**
 * Class for dealing with responses that return both a body and status
 */
export interface ResponseModel<T> {
    status: number;
    statusText: string;
    body: T;
}