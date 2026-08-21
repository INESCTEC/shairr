import { Component, ViewChild } from '@angular/core';
import { DefaultModalService } from 'src/services/default-modal.service';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { WidgetsToastComponent } from 'src/app/views/widgets/widgets-toast/widgets-toast.component';
import { RouteData } from 'src/models/route-data.model';
import { navItems } from './_nav';
import { DefaultNotificationsComponent } from './default-notifications/default-notifications.component';

@Component({
    selector: 'app-dashboard',
    templateUrl: './default-layout.component.html',
    styleUrls: ['./default-layout.component.scss']
})
export class DefaultLayoutComponent {
    @ViewChild(WidgetsToastComponent) private toast!: WidgetsToastComponent;

    public navItems = navItems;

    public perfectScrollbarConfig = {
        suppressScrollX: true,
    };

    routeData: RouteData = {};

    constructor(
        private router: Router, private route: ActivatedRoute
    ) {
        this.router.events
            .pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => {
                this.routeData = this.getMergedRouteData();
            });
    }

    private getMergedRouteData(): RouteData {
        let r: ActivatedRoute | null = this.router.routerState.root;

        const merged: RouteData = {};
        while (r) {
            Object.assign(merged, r.snapshot.data); 
            r = r.firstChild;
        }

        return merged as RouteData;
    }
}
