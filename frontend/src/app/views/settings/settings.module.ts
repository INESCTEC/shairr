import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import {
    AccordionModule,
    BadgeModule,
    ButtonModule,
    CardModule,
    DropdownModule,
    FormModule,
    GridModule,
    ModalModule,
    ProgressModule,
    SharedModule,
    SpinnerModule,
    TabsModule,
} from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';

import { SettingsRoutingModule } from './settings-routing.module';
import { GeneralSettingsComponent } from './general-settings/general-settings.component';

import { WidgetsModule } from '../widgets/widgets.module';

import { NgMultiSelectDropDownModule } from 'ng-multiselect-dropdown';

@NgModule({
    imports: [
        FormsModule,
        ReactiveFormsModule,
        SettingsRoutingModule,
        CardModule,
        TabsModule,
        CommonModule,
        GridModule,
        WidgetsModule,
        IconModule,
        ModalModule,
        ButtonModule,
        FormModule,
        DropdownModule,
        SpinnerModule,
        ProgressModule,
        BadgeModule,
        AccordionModule,
        ButtonModule,
        SharedModule,
        NgMultiSelectDropDownModule.forRoot()
    ],
    declarations: [
        GeneralSettingsComponent
    ]
})
export class SettingsModule {
}
