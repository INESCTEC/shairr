import { KeycloakEventType, KeycloakService } from 'keycloak-angular';

import { environment } from 'src/environments/environment';

export function initializeKeycloak(keycloak: KeycloakService) {
    return async () => {
        const keycloakInstance = await keycloak.init({
            config: {
                url: environment.authentication.url,
                realm: environment.authentication.realm,
                clientId: environment.authentication.clientId
            },
            initOptions: {
                onLoad: 'login-required',
                checkLoginIframe: false
            }
        });

        keycloak.keycloakEvents$.subscribe({
            next(event) {
                if (event.type == KeycloakEventType.OnTokenExpired) {
                    keycloak.updateToken(20);
                }
            }
        });

        return keycloakInstance;
    }
}

import { Injectable } from '@angular/core';
import {
    ActivatedRouteSnapshot, Router,
    RouterStateSnapshot
} from '@angular/router';
import { KeycloakAuthGuard } from 'keycloak-angular';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard extends KeycloakAuthGuard {
    constructor(
        protected override readonly router: Router,
        protected readonly keycloak: KeycloakService
    ) {
        super(router, keycloak);
    }

    public async isAccessAllowed(
        route: ActivatedRouteSnapshot,
        state: RouterStateSnapshot
    ) {
        // Force the user to log in if currently unauthenticated.
        if (!this.authenticated) {
            await this.keycloak.login({
                redirectUri: window.location.origin + state.url
            });
            return false;
        }

        await this.keycloak.updateToken(30);

        // Get the roles required from the route.
        const requiredRoles = route.data['roles'];

        // Allow the user to proceed if no additional roles are required to access the route.
        if (!Array.isArray(requiredRoles) || requiredRoles.length === 0) {
            return true;
        }

        // Allow the user to proceed if all the required roles are present.
        return requiredRoles.every((role) => this.roles.includes(role));
    }
}