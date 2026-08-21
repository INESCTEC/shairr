import { Component, EventEmitter, Output, Input } from '@angular/core';
import { DefaultModalService } from 'src/services/default-modal.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { ModalService } from '@coreui/angular'
import { GenotypeModel } from '../../../../models/shairr/datasources/genotype.model';
import { DatasourcesApiService } from 'src/services/datasources-api.service';
import { ToastType, ToastService  } from 'src/services/toast.service';
import { SubjectModel } from 'src/models/shairr/datasources/subject.model';
import { AlleleElement } from '../allele-picker/allele-picker.component';

@Component({
    selector: 'app-modal-create-allele',
    templateUrl: './modal-create-allele.component.html',
    styleUrls: ['./modal-create-allele.component.scss']
})
export class ModalCreateAllele {
    edit: boolean = false;
    id: number = 0;

    manual: boolean = true;

    @Output() onFinish = new EventEmitter<GenotypeModel | undefined>;

    formAllele: FormGroup;

    constructor(
        private datasourcesApi: DatasourcesApiService,
        private toastService: ToastService,
        private formBuilder: FormBuilder,
        private modalService: ModalService
    ) {
        this.formAllele = this.formBuilder.group({
            name: ['', Validators.required],
            mhc_class: ['', Validators.required],
        });
    }

    showToCreate() {
        this.edit = false;
        this.formAllele.reset();
        this.modalService.toggle({ show: true, id: 'modalCreateAllele' });
    }

    onSubmitAllele() {
        this.onFinish.emit(this.formAllele.value as GenotypeModel);
        this.modalService.toggle({ show: false, id: 'modalCreateAllele' });
    }
}
