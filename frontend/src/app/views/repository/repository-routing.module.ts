import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AnnotateFilesComponent } from './annotate-files/annotate-files.component';
import { CheckDatasetHeadComponent } from './check-tsv-head/check-dataset-head.component';
import { CreateEditSampleComponent } from './create-edit-sample/create-edit-sample.component';
import { CreateEditStudyComponent } from './create-edit-study/create-edit-study.component';
import { CreateEditSubjectComponent } from './create-edit-subject/create-edit-subject.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { OverviewComponent } from './statistics/overview/overview.component';

const routes: Routes = [
    {
        path: '',
        component: DashboardComponent,
        data: { title: 'Dashboard' },
    },
    {
        path: 'statistics',
        component: OverviewComponent,
        data: { title: 'Statistics' }
    },
    {
        path: 'check-dataset/:dataset_id',
        component: CheckDatasetHeadComponent,
        data: { title: 'Check Dataset Head' }
    },
    {
        path: 'create-study',
        component: CreateEditStudyComponent,
        data: { title: 'Create Study' }
    },
    {
        path: 'create-subject',
        component: CreateEditSubjectComponent,
        data: { title: 'Create Subject' }
    },
    {
        path: 'edit-subject/:subject_id',
        component: CreateEditSubjectComponent,
        data: { title: 'Edit Subject' }
    },
    {
        path: "create-sample",
        component: CreateEditSampleComponent,
        data: { title: "Create Sample" }
    },
    {
        path: 'edit-sample/:sample_id',
        component: CreateEditSampleComponent,
        data: { title: 'Edit Sample' }
    },
    {
        path: 'edit-study/:study_id',
        component: CreateEditStudyComponent,
        data: { title: 'Edit Study' }
    },
    {
        path: 'annotate-files',
        component: AnnotateFilesComponent,
        data: { title: 'Annotate Files' }
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class DatasourcesRoutingModule { }
