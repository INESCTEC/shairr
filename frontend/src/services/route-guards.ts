import { HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpError, NoWorkspaceException } from 'src/models/exceptions';


export class RouteGuards {
    static hasSelectedWorkspace() {
        const router = inject(Router);

        try {
            
        }
        catch (e) {
            if (e instanceof NoWorkspaceException) {
                router.navigate(['home']);
            }
        }

        return true;
    }
}
