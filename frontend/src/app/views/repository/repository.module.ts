import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import {
    AccordionModule,
    AlertComponent,
    BadgeModule,
    ButtonDirective,
    ButtonGroupModule,
    ButtonModule,
    CardHeaderComponent,
    CardModule,
    DropdownModule,
    FormModule,
    GridModule,
    ListGroupModule,
    ModalModule,
    ProgressModule,
    SharedModule,
    SpinnerModule,
    TableModule,
    Tabs2Module,
    TabsModule
} from '@coreui/angular';

import { IconModule } from '@coreui/icons-angular';

import { DragDropModule } from '@angular/cdk/drag-drop';

import { DatasourcesRoutingModule } from './repository-routing.module';

import { NgxSliderModule } from '@angular-slider/ngx-slider';
import { NgxDropzoneModule } from 'ngx-dropzone';
import { WidgetsModule } from '../widgets/widgets.module';

import { DatasourcesApiService } from '../../../services/datasources-api.service';
import { DefaultModalComponent } from '../widgets/default-modal/default-modal.component';
import { AnnotateFilesComponent } from './annotate-files/annotate-files.component';
import { CheckDatasetHeadComponent } from './check-tsv-head/check-dataset-head.component';
import { CreateEditSampleComponent } from './create-edit-sample/create-edit-sample.component';
import { CreateEditStudyComponent } from './create-edit-study/create-edit-study.component';
import { CreateEditSubjectComponent } from './create-edit-subject/create-edit-subject.component';
import { DashboardAirrComponent } from './dashboard/dashboard-airr/dashboard-airr.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { StatisticsModule } from './statistics/statistics.module';

@NgModule({
    declarations: [
        DashboardComponent,
        DashboardAirrComponent,
        CreateEditStudyComponent,
        CreateEditSubjectComponent,
        CreateEditSampleComponent,
        CheckDatasetHeadComponent,
        AnnotateFilesComponent
    ],
    imports: [
        CommonModule,
        DatasourcesRoutingModule,
        CardModule,
        DefaultModalComponent,
        AlertComponent,
        FormModule,
        CardHeaderComponent,
        GridModule,
        ButtonModule,
        FormsModule,
        TableModule,
        ReactiveFormsModule,
        ButtonModule,
        ButtonGroupModule,
        ButtonDirective,
        DropdownModule,
        Tabs2Module,
        TabsModule,
        AccordionModule,
        SharedModule,
        IconModule,
        ListGroupModule,
        SpinnerModule,
        WidgetsModule,
        NgxDropzoneModule,
        NgxSliderModule,
        ModalModule,
        BadgeModule,
        ProgressModule,
        DragDropModule,
        StatisticsModule
    ],
    providers: [DatasourcesApiService],
})
export class RepositoryModule { }
