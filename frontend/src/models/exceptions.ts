export class HttpError extends Error {
    status?: number;

    constructor(message: string | undefined, status?: number) {
        super(message);
        this.status = status;
    }
}

export class UnauthorizedException extends HttpError {
    override status: number = 401 
}

export class NoWorkspaceException extends Error {

}

export class InvalidWorkspaceException extends Error {

}

export class PdbServiceError extends Error {

}