import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { EbiResponseModel } from 'src/models/ebi/alleles.model';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, timeout, delay } from 'rxjs/operators';

@Injectable({
    providedIn: 'root',
})
export class EBIService {
    private ebiUrl: string = environment.emblEbiUrl;
    private lastRequestTime: number = 0;
    private minRequestInterval: number = 2000; // 2 seconds minimum between requests

    private organismGroups = {
        HLA: 'Human (HLA)',
        NHP: 'Non-human primates',
        DLA: 'Canids',
        FISH: 'Salmonids',
        OLA: 'Ovids',
        BoLA: 'Bovins',
        ELA: 'Equids',
        SLA: 'Suids',
        RT1: 'Murids',
        CHICKEN: 'Gallus',
        CLA: 'Capra',
        CeLA: 'Cetacea',
    };

    constructor(private http: HttpClient) {}

    async getAlleles(
        project: 'HLA' | 'MHC',
        prev?: string,
        next?: string,
        classString?: string,
        organismGroup?: string,
        containsString?: string
    ): Promise<EbiResponseModel> {
        // Rate limiting
        await this.enforceRateLimit();

        let params = new HttpParams();

        // Build query
        let queryParts: string[] = [];

        if (classString) {
            queryParts.push(`eq(class,"${classString}")`);
        }

        if (organismGroup) {
            queryParts.push(`contains(organism.group,"${organismGroup}")`);
        }

        if (containsString) {
            queryParts.push(`contains(name,"${containsString}")`);
        }

        // Combine query parts
        if (queryParts.length > 0) {
            let query = '';
            if (queryParts.length === 1) {
                query = queryParts[0];
            } else {
                query = `and(${queryParts.join(',')})`;
            }
            params = params.set('query', query);
        }

        // Add pagination - ONLY if no search filters were changed
        // If we're doing a new search (any filter is provided), reset pagination
        // Add pagination - just pass them through
        if (prev) {
            const cleanToken = prev.includes('prev=')
                ? prev.split('prev=')[1]
                : prev;
            params = params.set('prev', cleanToken);
        }

        if (next) {
            const cleanToken = next.includes('next=')
                ? next.split('next=')[1]
                : next;
            params = params.set('next', cleanToken);
        }

        // Add project
        params = params.set('project', project);

        // Use Angular HttpClient which handles CORS better
        return this.http
            .get<EbiResponseModel>(this.ebiUrl + '/allele', {
                params: params,
                headers: new HttpHeaders({
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                }),
            })
            .pipe(
                timeout(3000), // 3 second timeout only
                retry(2), // Retry up to 2 times on failure
                catchError((error) => {
                    console.error('EBI API Error:', error);
                    return throwError(
                        () =>
                            new Error(
                                `EBI API request failed: ${error.message}`
                            )
                    );
                })
            )
            .toPromise() as Promise<EbiResponseModel>;
    }

    // Rate limiting helper
    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            console.log(`Rate limiting: waiting ${waitTime}ms`);
            await this.delay(waitTime);
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    getSupportedOrganisms() {
        return this.organismGroups;
    }
}
