import { HttpStatusCode } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AIRRRequestModel } from 'src/models/airr/airrrequest.model';
import { InfoModel } from 'src/models/airr/info.model';
import { RearrangementModel } from 'src/models/airr/rearrangement.model';
import { RepertoireModel } from 'src/models/airr/repertoire.model';
import { ResponseModel } from 'src/models/response.model';
import { RepositoryModel } from 'src/models/shairr/repository.model';

@Injectable({
    providedIn: 'root'
})
export class AIRRService {
    constructor() { }

    public repository!: RepositoryModel;

    private authToken?: string;

    /**
     * Throws a 404 status exception if the result contains no entries
     *
     * Use-case: When you try to access an non-existing, the ADC-API doesn't
     * return a 404 error. Instead it returns a empty array.
     *
     * @param result
     */
    private throwOnEmpty(result: any): void {
        if (!result.length) {
            let error = new AIRRException();
            error.status = HttpStatusCode.NotFound;
            throw error;
        }
    }

    private buildAuth(): string {
        return "bearer " + this.authToken;
    }


    public setAuthToken(token?: string) {
        this.authToken = token;
    }

    public getAuthToken() {
        return this.authToken;
    }

    /**
     * Wrapper around fetch that:
     *  - builds the full URL from repository.url + path
     *  - conditionally adds Authorization header when repository is local
     */
    private fetchFromRepository(
        path: string,
        init: RequestInit = {}
    ): Promise<Response> {
        const url = `${this.repository.url}${path}`;

        // Normalise/merge headers
        const headers = new Headers(init.headers || {});

        if (this.authToken) {
            headers.set('Authorization', this.buildAuth());
        }

        return fetch(url, {
            ...init,
            headers
        });
    }

    isReachable(url: string): Promise<boolean> {
        return fetch(url).then(res => res.json())
    }

    getRepository(): RepositoryModel {
        return this.repository;
    }

    setRepository(repository: RepositoryModel) {
        this.repository = repository;
    }

    getInfo(): Promise<ResponseModel<InfoModel>> {
        return this.fetchFromRepository('/info')
            .then(response => {
                return response.json().then(data => ({
                    status: response.status,
                    statusText: response.statusText,
                    body: data as InfoModel
                }));
            });
    }

    getRepertoireIdFacets(): Promise<any[]> {
        const body: AIRRRequestModel = {
            facets: ['repertoire_id']
        };

        return this.fetchFromRepository('/repertoire', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify(body)
        })
            .then(res => res.json())
            .then(res => {
                this.throwOnEmpty(res['Repertoire']);
                return res['Repertoire'];
            });
    }

    getRepertoires(fields?: string[]): Promise<RepertoireModel[]> {
        const body: AIRRRequestModel = {};

        if (fields) {
            body.fields = fields;
        }

        return this.fetchFromRepository('/repertoire', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify(body)
        })
            .then(res => res.json())
            .then(res => {
                this.throwOnEmpty(res['Repertoire']);
                return res['Repertoire'];
            });
    }

    getRepertoire(repertoireId: string): Promise<RepertoireModel> {
        return this.fetchFromRepository('/repertoire/' + repertoireId)
            .then(res => res.json())
            .then(res => {
                this.throwOnEmpty(res['Repertoire']);
                return res['Repertoire'][0];
            });
    }

    getRearrangements(repertoireId: string): Promise<RearrangementModel[]> {
        const body: AIRRRequestModel = {
            filter: {
                content: {
                    field: 'repertoire_id',
                    value: repertoireId
                }
            },
            fields: [
                'sequence_id', 'junction_aa', 'v_call', 'd_call', 'j_call'
            ],
            size: 10 // TODO Debugging only
        };

        return this.fetchFromRepository('/rearrangement', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify(body)
        })
            .then(res => res.json())
            .then(res => {
                this.throwOnEmpty(res['Rearrangement']);
                return res['Rearrangement'];
            });
    }
}

export class AIRRException extends Error {
    status?: number;
}