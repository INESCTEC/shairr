import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

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
    ProgressModule,
    SharedModule,
    SpinnerModule,
    TableModule,
    ToastModule,
    WidgetModule,
    TooltipModule
} from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';
import { AirrFilterItemComponent } from './airr-filter/airr-filter-item/airr-filter-item.component';
import { AirrFilterComponent } from './airr-filter/airr-filter.component';
import { AllelePickerComponent } from './allele-picker/allele-picker.component';
import { AllelePickerBulkComponent } from './allele-picker-bulk/allele-picker-bulk.component';
import { AlleleTagsComponent } from './allele-tags/allele-tags.component';
import { ButtonDownloadComponent } from './btn-download/button-download.component';
import { DiseaseAutocompleteComponent } from './disease-autocomplete/disease-autocomplete.component';
import { ModalCreateAllele } from './modal-create-allele/modal-create-allele.component';
import { SpeciesAutocompleteComponent } from './species-autocomplete/species-autocomplete.component';
import { WidgetsToastComponent } from './widgets-toast/widgets-toast.component';

import { RouterModule } from '@angular/router';
import { NgMultiSelectDropDownModule } from 'ng-multiselect-dropdown';

import { NgxDropzoneModule } from 'ngx-dropzone';
import { UberonAutocompleteComponent } from './uberon-autocomplete/uberon-autocomplete.component';
import { CellAutocompleteComponent } from './cell-autocomplete/cell-autocomplete.component';
import { TimelineEditorComponent } from './timeline-editor/timeline-editor.component';
import { DragDropModule } from '@angular/cdk/drag-drop';

@NgModule({
    declarations: [
        ModalCreateAllele,
        WidgetsToastComponent,
        DiseaseAutocompleteComponent,
        SpeciesAutocompleteComponent,
        TimelineEditorComponent,
        CellAutocompleteComponent,
        UberonAutocompleteComponent,
        ButtonDownloadComponent,
        AlleleTagsComponent,
        AirrFilterComponent,
        AirrFilterItemComponent,
        AllelePickerComponent,
        AllelePickerBulkComponent
    ],
    imports: [
        FormsModule,
        ReactiveFormsModule,
        RouterModule,
        CommonModule,
        GridModule,
        DragDropModule,
        WidgetModule,
        IconModule,
        DropdownModule,
        SharedModule,
        ButtonModule,
        CardModule,
        ProgressModule,
        ListGroupModule,
        ToastModule,
        ModalModule,
        FormModule,
        SpinnerModule,
        ButtonGroupModule,
        TableModule,
        AccordionModule,
        BadgeModule,
        NgxDropzoneModule,
        NgMultiSelectDropDownModule.forRoot(),
        TooltipModule
    ],
    exports: [
        WidgetsToastComponent,
        TimelineEditorComponent,
        ButtonDownloadComponent,
        SpeciesAutocompleteComponent,
        DiseaseAutocompleteComponent,
        CellAutocompleteComponent,
        UberonAutocompleteComponent,
        AlleleTagsComponent,
        AirrFilterComponent,
        AirrFilterItemComponent,
        AllelePickerComponent,
        AllelePickerBulkComponent
    ]
})
export class WidgetsModule { }
