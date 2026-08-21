import { Component } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'dashboard-airr',
    templateUrl: './dashboard-airr.component.html',
    styleUrl: './dashboard-airr.component.scss',
})
export class DashboardAirrComponent {
    public readonly shairrApiUrl = environment.shairrApiUrl;
    public readonly baseUri = {
        v1: "/airr/v1"
    };
}
