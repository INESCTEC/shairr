import { Component, EventEmitter, Output } from '@angular/core';
import { DefaultModalService } from 'src/services/default-modal.service';
import { AirrField } from 'src/models/airr/airr-field.model';
import { RepertoireModel } from 'src/models/airr/repertoire.model';

@Component({
    selector: 'app-airr-filter',
    templateUrl: './airr-filter.component.html',
    styleUrl: './airr-filter.component.scss'
})
export class AirrFilterComponent {
    @Output() filtered = new EventEmitter<AirrField[]>();

    filterStudy: AirrField[] = [
        {
            field: 'study.study_id',
            title: 'Study ID',
            category: 'study'
        },
        {
            field: 'study.title',
            title: 'Study Title',
            category: 'study'
        },
        {
            field: 'study.description',
            title: 'Study Description',
            category: 'study'
        },
        {
            field: 'study.submittedBy',
            title: 'Submitted By',
            category: 'study',
            filter: (repertoire: RepertoireModel, param: any) => {
                return repertoire.study.submitted_by?.includes(param as string) || false;
            }
        }];


    filterSubject: AirrField[] = [{
        field: 'subject_id',
        title: 'Subject ID',
        category: 'subject'
    },
    {
        field: 'subject.species.id',
        title: 'Organism',
        category: 'subject'
    },
    {
        field: 'subject.synthetic',
        title: 'Synthetic',
        category: 'subject'
    },
    {
        field: 'subject.diagnosis',
        title: 'Diagnosis',
        category: 'subject'
    },
    {
        field: 'subject.mhc_genotype_list',
        title: 'Alleles (MHC/HLA)',
        category: 'subject',
        filter: (repertoire: RepertoireModel, param: any) => {
            const mhcs = repertoire.subject.genotype?.mhc_genotype_list || [];
            const matches: string[] = mhcs.filter((w: string) => w.includes(param));

            return matches.length > 0;
        }
    }];

    filterSample: AirrField[] = [
        {
            field: 'sample[0].sample_id',
            title: 'Sample ID',
            category: 'sample'
        },
        {
            field: 'sample',
            title: 'Cell Subset',
            category: 'sample',
            filter: (repertoire: RepertoireModel, param: any) => {
                for (let sample of repertoire.sample || []) {
                    if (sample.cell_subset && sample.cell_subset.label?.includes(param)) {
                        return true;
                    }
                }

                return false;
            }
        }
    ];

    filtersSelected: AirrField[] = [];

    onFiltered(field: AirrField) {
        if (!this.filtersSelected.some(existingField => existingField.field == field.field)) {
            this.filtersSelected.push(field);
        }

        this.filtered.emit(this.filtersSelected);
    }

    onRemoveFilter(filterIndex: number) {
        this.filtersSelected.splice(filterIndex, 1);
        this.filtered.emit(this.filtersSelected);
    }
}
