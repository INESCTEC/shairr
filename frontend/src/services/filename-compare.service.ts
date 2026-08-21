import { Injectable } from '@angular/core';

import { environment } from 'src/environments/environment';


import { KeycloakService } from 'keycloak-angular';


export interface ComparisonResult {
    same: number
    different: number
}

@Injectable({
    providedIn: 'root',
})
export class FilenameCompareService {
    private shairrApiUrl: string = environment.shairrApiUrl;

    constructor(
        private keycloak: KeycloakService
    ) { }

    compareFileNames(fileName1: string, fileName2: string): ComparisonResult {
        if (fileName1.length !== fileName2.length) {
            return { same: 0, different: 0 };
        }

        var same = 0, different = 0;
        for (let i = 0; i < fileName1.length; i++) {
            if (fileName1[i] == fileName2[i]) {
                same++;
            } else {
                different++;
            }
        }

        return { same: same, different: different };
    }

    getSimilarityScore(fileName1: string, fileName2: string): number {
        const comparison = this.compareFileNames(fileName1, fileName2);
        return comparison.same / (comparison.same + comparison.different);
    }

    getDifferenceScore(fileName1: string, fileName2: string): number {
        const comparison = this.compareFileNames(fileName1, fileName2);
        return comparison.different / (comparison.same + comparison.different);
    }

    areFileNamesPaired(fileName1: string, fileName2: string): boolean {
        const comparison = this.compareFileNames(fileName1, fileName2);
        return comparison.different < 4;
    }
}
