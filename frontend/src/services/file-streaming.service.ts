import { HttpClient, HttpEvent, HttpEventType, HttpProgressEvent, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, distinctUntilChanged, scan } from 'rxjs';

import { saveAs } from 'file-saver';

@Injectable({
    providedIn: 'root'
})
export class FileStreamingService {
    /**
     * Adapted from https://stackblitz.com/edit/angular-file-download-progress-qsqsnf
     */
    constructor(private http: HttpClient) {

    }

    private isHttpResponse<T>(event: HttpEvent<T>): event is HttpResponse<T> {
        return event.type === HttpEventType.Response;
    }

    private isHttpProgressEvent(event: HttpEvent<unknown>): event is HttpProgressEvent {
        return (event.type === HttpEventType.DownloadProgress || event.type === HttpEventType.UploadProgress);
    }

    private handleState(saver?: (b: Blob) => void): (source: Observable<HttpEvent<Blob>>) => Observable<DownloadMetadata> {
        return (source: Observable<HttpEvent<Blob>>) =>
            source.pipe(
                scan(
                    (download: DownloadMetadata, event: HttpEvent<Blob>): DownloadMetadata => {
                        if (this.isHttpProgressEvent(event)) {
                            return {
                                progress: event.total
                                    ? Math.round((100 * event.loaded) / event.total) : download.progress,
                                state: "IN_PROGRESS",
                                content: null
                            };
                        }

                        if (this.isHttpResponse(event)) {
                            if (saver) {
                                saver(event.body!);
                            }

                            return {
                                progress: 100,
                                state: "DONE",
                                content: event.body
                            };
                        }

                        return download;
                    },
                    { state: "PENDING", progress: 0, content: null }
                ),
                distinctUntilChanged((previous, current) => previous.state === current.state
                    && previous.progress === current.progress
                    && previous.content === current.content
                )
            );
    }

    download(url: string, auth: string, filename?: string): Observable<DownloadMetadata> {
        return this.http.get(url, {
            reportProgress: true,
            observe: 'events',
            responseType: 'blob',
            headers: {
                Authorization: auth
            }
        }).pipe(this.handleState(blob => saveAs(blob, filename)))
    }

    static getServerFilename(contentDisposition: string): string | undefined {
        const fileNameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = fileNameRegex.exec(contentDisposition);

        if (matches != null && matches[1]) {
            return matches[1].replace(/['"]/g, '');
        }

        return undefined;
    }
}

export interface DownloadMetadata {
    content: Blob | null;
    progress: number;
    state: "PENDING" | "IN_PROGRESS" | "DONE";
}
