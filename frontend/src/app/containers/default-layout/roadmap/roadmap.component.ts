import { Component, Input } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { RouteData } from 'src/models/route-data.model';
import { RouteContextService } from 'src/services/route-context.service';

export interface RoadmapLink {
    name: string;
    link?: string;
    activeCondition: () => Promise<boolean>;
    active: boolean;
    parent?: string;
}

@Component({
    selector: 'app-roadmap',
    templateUrl: './roadmap.component.html',
    styleUrl: './roadmap.component.scss'
})
export class RoadmapComponent {
    @Input() milestones: RoadmapLink[] = [];

    private openedRepositoryId?: string;
    private routeData?: RouteData;
    private currentUrlParams: string = '';

    private inRepositoryModule(): boolean {
        const url = this.router.url;
        if (url.split('/').length > 2 && url.split('/')[2] === 'repository') {
            const repositoryId = url.split('/')[3];
            this.openedRepositoryId = repositoryId;
        }
        return url.startsWith('/repository');
    }

    private inCreateStudyPage(): boolean {
        const url = this.router.url;
        return url.includes('/create-study');
    }

    private inEditStudyPage(): boolean {
        const url = this.router.url;
        return url.includes('/edit-study');
    }

    private inEditSubjectPage(): boolean {
        const url = this.router.url;
        return url.includes('/edit-subject');
    }

    private inCreateSubjectPage(): boolean {
        const url = this.router.url;
        return url.includes('/create-subject');
    }

    private inCreateSamplePage(): boolean {
        const url = this.router.url;
        return url.includes('/create-sample');
    }

    private inEditSamplePage(): boolean {
        const url = this.router.url;
        return url.includes('/edit-sample');
    }

    private inDatasetPage(): boolean {
        const url = this.router.url;
        return url.includes('check-dataset');
    }

    private urlIncludes(currentUrl: string): boolean {
        return this.router.url.includes(currentUrl);
    }

    private extractUrlParams(): string {
        const url = this.router.url;
        const hashIndex = url.indexOf('#');
        if (hashIndex === -1) return '';

        const hash = url.substring(hashIndex + 1);
        const paramIndex = hash.indexOf(';');
        if (paramIndex === -1) return '';

        // Decode the parameters to handle double encoding
        const params = hash.substring(paramIndex);
        return decodeURIComponent(params);
    }

    private cleanUrlForDisplay(fullUrl: string): string {
        const hashIndex = fullUrl.indexOf('#');
        if (hashIndex === -1) return fullUrl;

        const beforeHash = fullUrl.substring(0, hashIndex);
        const hash = fullUrl.substring(hashIndex + 1);
        const paramIndex = hash.indexOf(';');

        if (paramIndex === -1) return fullUrl;

        const cleanHash = hash.substring(0, paramIndex);
        return `${beforeHash}#${cleanHash}`;
    }

    private navigateWithParams(basePath: string) {
        const params = this.currentUrlParams;
        let targetUrl = basePath;

        if (params && !targetUrl.includes(';')) {
            // Add the parameters back
            const hashIndex = targetUrl.indexOf('#');
            if (hashIndex !== -1) {
                targetUrl = targetUrl.substring(0, hashIndex) + '#' + targetUrl.substring(hashIndex + 1) + params;
            } else {
                targetUrl = targetUrl + '#' + params.substring(1); // Remove the leading ;
            }
        }

        this.router.navigateByUrl(targetUrl);
    }

    constructor(
        private router: Router,
        private routeContext: RouteContextService,
        private route: ActivatedRoute
    ) {
        this.currentUrlParams = this.extractUrlParams();
        this.evalActiveLinks();

        this.sub = this.router.events
            .pipe(filter(e => e instanceof NavigationEnd))
            .subscribe(() => {
                let r = this.route;
                while (r.firstChild) r = r.firstChild;
                this.routeData = r.snapshot.data ?? undefined;
                this.currentUrlParams = this.extractUrlParams();
                this.evalActiveLinks();
            });
    }

    private buildLinks(): RoadmapLink[] {
        const url = this.router.url;

        const repertoireMatch = url.match(/\/repertoire\/([^\/]+)/)
        const studyMatch = url.match(/\/(create-study|edit-study)\/?([^\/]*)/);
        const subjectMatch = url.match(/\/(create-subject|edit-subject)\/?([^\/]*)/);
        const sampleMatch = url.match(/\/(create-sample|edit-sample)\/?([^\/]*)/);
        const datasetMatch = url.match(/\/dataset\/?([^\/]*)/);

        if (repertoireMatch) {
            this.routeContext.set('repertoireId', repertoireMatch[1]);
        }

        // Clean the IDs when storing them
        if (studyMatch && studyMatch[2]) {
            const cleanId = studyMatch[2].split(';')[0].split('%3B')[0];
            this.routeContext.set('study_id', cleanId);
        }

        if (subjectMatch && subjectMatch[2]) {
            const cleanId = subjectMatch[2].split(';')[0].split('%3B')[0];
            this.routeContext.set('subject_id', cleanId);
        }

        if (sampleMatch && sampleMatch[2]) {
            const cleanId = sampleMatch[2].split(';')[0].split('%3B')[0];
            this.routeContext.set('sample_id', cleanId);
        }

        if (datasetMatch && datasetMatch[1]) {
            const cleanId = datasetMatch[1].split(';')[0].split('%3B')[0];
            this.routeContext.set('dataset_id', cleanId);
        }

        const repertoireId = this.routeContext.get('repertoireId');
        const study_id = this.routeContext.get('study_id');
        const subject_id = this.routeContext.get('subject_id');
        const sample_id = this.routeContext.get('sample_id');
        const dataset_id = this.routeContext.get('dataset_id');

        const urlParams = new URLSearchParams(window.location.search);
        const queryStudyId = urlParams.get('id_study');
        const querySubjectId = urlParams.get('id_subject');

        // Create the links with navigation handlers
        return [
            {
                name: 'Dashboard',
                link: '/repository',
                activeCondition: async () => {
                    return true;
                },
                active: false
            },
            {
                name: "Study",
                link: (() => {
                    if (study_id) {
                        return `/repository/edit-study/${study_id}`;
                    } else if (queryStudyId) {
                        return `/repository/edit-study/${queryStudyId}`;
                    }
                    return '/repository/create-study';
                })(),
                activeCondition: async () => {
                    return this.inRepositoryModule() &&
                        (this.inCreateStudyPage() || this.inEditStudyPage() ||
                            this.inCreateSubjectPage() || this.inEditSubjectPage() ||
                            this.inCreateSamplePage() || this.inEditSamplePage());
                },
                active: this.inCreateStudyPage() || this.inEditStudyPage(),
                parent: 'Datasources'
            },
            {
                name: "Subject",
                link: (() => {
                    if (subject_id) {
                        const numericId = parseInt(subject_id, 10);
                        if (!isNaN(numericId)) {
                            return `/repository/edit-subject/${numericId}`;
                        }
                    } else if (querySubjectId) {
                        const numericId = parseInt(querySubjectId, 10);
                        if (!isNaN(numericId)) {
                            return `/repository/edit-subject/${numericId}`;
                        }
                    }
                    return '/repository/create-subject';
                })(),
                activeCondition: async () => {
                    return this.inRepositoryModule() &&
                        (this.inCreateSubjectPage() || this.inEditSubjectPage() ||
                            this.inCreateSamplePage() || this.inEditSamplePage());
                },
                active: this.inCreateSubjectPage() || this.inEditSubjectPage(),
                parent: 'Study'
            },
            {
                name: "Sample",
                link: (() => {
                    if (sample_id) {
                        const numericId = parseInt(sample_id, 10);
                        if (!isNaN(numericId)) {
                            return `/repository/edit-sample/${numericId}`;
                        }
                    }
                    return '/repository/create-sample';
                })(),
                activeCondition: async () => {
                    return this.inRepositoryModule() &&
                        (this.inCreateSamplePage() || this.inEditSamplePage());
                },
                active: this.inCreateSamplePage() || this.inEditSamplePage(),
                parent: 'Subject'
            },
            {
                name: "Dataset",
                link: "/repository/check-dataset",
                activeCondition: async () => {
                    return this.inRepositoryModule() && this.inDatasetPage();
                },
                active: false,
                parent: 'Sample'
            },
        ];
    }

    onRoadmapLinkClick(link: string | undefined, event: Event) {
        if (!link) return;
        event.preventDefault();

        const hash = window.location.hash;
        const match = hash.match(/;.*$/);
        const params = match ? match[0] : '';

        let url = link;
        if (params) {
            url = link + params;
        }

        this.router.navigateByUrl(url);
    }

    private sub?: Subscription;

    private evalActiveLinks() {
        this.milestones = this.buildLinks();
        for (let i in this.milestones) {
            this.milestones[i].activeCondition().then((active: boolean) => {
                this.milestones[i].active = active;
            });
        }
    }
}