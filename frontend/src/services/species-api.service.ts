import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
    SpeciesSearchResult,
    SpeciesTerm,
} from '../models/shairr/datasources/species.model';

@Injectable({
    providedIn: 'root',
})
export class SpeciesOntologyService {
    private shairrApiUrl: string = environment.shairrApiUrl;
    private baseUrl = this.shairrApiUrl + '/species';

    constructor(private http: HttpClient) { }

    search(query: string, limit: number = 20): Observable<SpeciesTerm[]> {
        return this.http
            .get<SpeciesSearchResult>(
                `${this.baseUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}`,
            )
            .pipe(map((response) => response.results));
    }

    getTermById(id: string): Observable<SpeciesTerm> {
        return this.http.get<SpeciesTerm>(`${this.baseUrl}/terms/${id}`);
    }

    getTermByLabel(label: string): Observable<SpeciesTerm> {
        return this.http.get<SpeciesTerm>(
            `${this.baseUrl}/terms/label/${encodeURIComponent(label)}`,
        );
    }

    getCommonSpecies(): Observable<SpeciesTerm[]> {
        return this.http.get<SpeciesTerm[]>(`${this.baseUrl}/common`);
    }
}
