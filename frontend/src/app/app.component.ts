import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';

import { IconSetService } from '@coreui/icons-angular';
import { iconSubset } from './icons/icon-subset';

import { Title } from '@angular/platform-browser';
import { filter } from 'rxjs';

@Component({
    selector: 'app-root',
    template: '<router-outlet></router-outlet><app-default-modal></app-default-modal>',
})
export class AppComponent implements OnInit {

    constructor(
        private router: Router,
        route: ActivatedRoute,
        title: Title,
        private iconSetService: IconSetService,
    ) {
        iconSetService.icons = { ...iconSubset };
        router.events
            .pipe(filter(e => e instanceof NavigationEnd))
            .subscribe(() => {
                let r = route;
                while (r.firstChild) r = r.firstChild;

                const pageTitle = r.snapshot.data['title'];
                if (pageTitle) {
                    title.setTitle(`ShAIRR | ${pageTitle}`);
                }
            });

    }

    ngOnInit(): void {
        this.router.events.subscribe((evt) => {
            if (!(evt instanceof NavigationEnd)) {
                return;
            }
        });

    }
}
