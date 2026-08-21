import { Component, Input } from '@angular/core';
import { DefaultModalService } from 'src/services/default-modal.service';
import { Router } from '@angular/router';

import { ClassToggleService, HeaderComponent } from '@coreui/angular';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakProfile } from 'keycloak-js';
import { RouteData } from 'src/models/route-data.model';


@Component({
    selector: 'app-default-header',
    templateUrl: './default-header.component.html',
    styleUrls: ['default-header.component.scss']
})
export class DefaultHeaderComponent extends HeaderComponent {
    @Input() sidebarId: string = "sidebar";
    @Input() routeData: RouteData = {}

    public newMessages = new Array(4)
    public newTasks = new Array(5)
    public newNotifications = new Array(5)
    public username = "";
    public userPersonalName = "";

    constructor(
        private classToggler: ClassToggleService,
        private keycloak: KeycloakService,
        private router: Router
    ) {
        super();

        this.router = router;

        this.keycloak.loadUserProfile().then((profile: KeycloakProfile) => {

            if (profile.firstName) {
                this.userPersonalName = profile.firstName + " ";
            }

            if (profile.lastName) {
                this.userPersonalName += profile.lastName;
            }

            this.username = profile.username || "";
        });
    }

    profile() {
        let profileUrl = this.keycloak.getKeycloakInstance().createAccountUrl();
        window.open(profileUrl, '_blank')?.focus();
    }

    logout() {
        this.keycloak.logout();
    }

    settings() {
        this.router.navigate(['/settings/general']);
    }
}
