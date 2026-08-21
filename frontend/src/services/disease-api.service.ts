import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { DiseaseTerm } from '../models/shairr/datasources/disease.model';

@Injectable({
    providedIn: 'root',
})
export class DiseaseOntologyService {
    private shairrApiUrl: string = environment.shairrApiUrl;
    private baseUrl = this.shairrApiUrl + '/disease';

    constructor(private http: HttpClient) { }

    search(query: string, limit: number = 20): Observable<DiseaseTerm[]> {
        return this.http
            .get<{
                results: DiseaseTerm[];
            }>(`${this.baseUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}`)
            .pipe(map((response) => response.results));
    }

    getTermById(id: string): Observable<DiseaseTerm> {
        return this.http.get<DiseaseTerm>(`${this.baseUrl}/terms/${id}`);
    }

    getTermByLabel(label: string): Observable<DiseaseTerm> {
        return this.http.get<DiseaseTerm>(
            `${this.baseUrl}/terms/label/${encodeURIComponent(label)}`,
        );
    }

    getAllTerms(
        skip: number = 0,
        limit: number = 100,
    ): Observable<DiseaseTerm[]> {
        return this.http.get<DiseaseTerm[]>(
            `${this.baseUrl}/terms?skip=${skip}&limit=${limit}`,
        );
    }
}
