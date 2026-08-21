import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// CoreUI imports
import {
    AccordionModule,
    BadgeModule,
    ButtonGroupModule,
    ButtonModule,
    CardModule,
    DropdownModule,
    FormModule,
    GridModule,
    ListGroupModule,
    ModalModule,
    NavModule,
    SharedModule,
    SpinnerModule,
    TableModule,
    TabsModule,
} from '@coreui/angular';

import { IconModule } from '@coreui/icons-angular';

import { PlotlyModule } from 'angular-plotly.js';
import * as PlotlyJS from 'plotly.js-dist-min';

PlotlyModule.plotlyjs = PlotlyJS;

import { Cdr3LengthComponent } from './cdr3-length/cdr3-length.component';
import { GeneUsageComponent } from './gene-usage/gene-usage.component';
import { OverviewComponent } from './overview/overview.component';
import { TopClonesComponent } from './top-clones/top-clones.component';

import { WidgetsModule } from '../../widgets/widgets.module';

@NgModule({
    declarations: [
        OverviewComponent,
        Cdr3LengthComponent,
        TopClonesComponent,
        GeneUsageComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        CardModule,
        FormModule,
        GridModule,
        ButtonModule,
        ButtonGroupModule,
        DropdownModule,
        TableModule,
        SharedModule,
        IconModule,
        ListGroupModule,
        SpinnerModule,
        NavModule,
        TabsModule,
        ModalModule,
        AccordionModule,
        BadgeModule,
        PlotlyModule,
        WidgetsModule
    ],
    providers: [],
})
export class StatisticsModule { }