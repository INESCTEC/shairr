import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { DefaultModalService } from 'src/services/default-modal.service';
import { ActivatedRoute, Router } from '@angular/router';
import { DataProcessingModel } from 'src/models/airr/data-processing.model';
import { SampleModel } from 'src/models/shairr/datasources/sample.model';
import { ToastType, ToastService } from 'src/services/toast.service';
import { DatasourcesApiService } from 'src/services/datasources-api.service';
import { ChangeDetectorRef } from '@angular/core';
import { DropdownComponent } from '@coreui/angular';
import { CommonModule } from '@angular/common';
import {
    Form,
    FormsModule,
    UntypedFormBuilder,
    UntypedFormControl,
    UntypedFormGroup,
} from '@angular/forms';
import { DatasetModel } from 'src/models/shairr/datasources/dataset.model';
import { StudyModel } from '../../../../models/shairr/datasources/study.model';
import { SubjectModel } from '../../../../models/shairr/datasources/subject.model';
import { DiagnosisModel } from '../../../../models/shairr/datasources/diagnosis.model';
import { TimepointModel } from '../../../../models/shairr/datasources/timepoint.model';
import {
    AlleleElement,
    AllelePickerComponent,
} from '../../widgets/allele-picker/allele-picker.component';
import { OntologyModel } from '../../../../models/airr/ontology.model';
import { GenotypeModel } from '../../../../models/shairr/datasources/genotype.model';
import { Location } from '@angular/common';
import { AlleleModel } from 'src/models/ebi/alleles.model';
import { DiseaseAutocompleteComponent } from '../../widgets/disease-autocomplete/disease-autocomplete.component';
import { SpeciesAutocompleteComponent } from '../../widgets/species-autocomplete/species-autocomplete.component';
import { DiseaseTerm } from '../../../../models/shairr/datasources/disease.model';
import { SpeciesTerm } from '../../../../models/shairr/datasources/species.model';
import { IdGeneratorService } from '../../../../services/id-generator.service';

@Component({
    selector: 'app-create-edit-subject',
    templateUrl: './create-edit-subject.component.html',
    styleUrls: ['./create-edit-subject.component.scss'],
    providers: [DropdownComponent, AllelePickerComponent],
})
export class CreateEditSubjectComponent {
    @Output() onCreate = new EventEmitter<any>();
    @Output() onClose = new EventEmitter<void>();
    selectedDisease: DiseaseTerm | null = null;
    selectedSpecies: SpeciesTerm | null = null;
    diseaseDisplayText: string = '';
    speciesDisplayText: string = '';

    subjectForm: any;
    info: any;
    loading: boolean = false;
    seeMoreFlag: boolean = false;
    studies: StudyModel[] = [];
    samples: SampleModel[] = [];
    subject: SubjectModel | null = null;
    mhc_genotype_list: GenotypeModel[] = [];
    timepoints: TimepointModel[] = [];
    displayTimepoints: TimepointModel[] = [];
    url: string = '';
    route: ActivatedRoute;
    editMode: { [key: number]: boolean } = {};
    savedSubject: boolean = false;
    showSubjectForm: boolean = true;

    constructor(
        private modalService: DefaultModalService,
        private idGeneratorService: IdGeneratorService,
        public router: Router,
        private activatedRoute: ActivatedRoute,
        private datasourcesApiService: DatasourcesApiService,
        private formBuilder: UntypedFormBuilder,
        private toastService: ToastService,
        private cdr: ChangeDetectorRef,
        private location: Location,
    ) {
        this.activatedRoute = activatedRoute;
        this.url = window.location.href;
        this.route = activatedRoute;
    }

    ngOnInit() {
        if (this.url.includes('edit')) {
            this.showSubjectForm = true;
            this.route.params.subscribe(async (params) => {
                if (this.subject == null && this.url.includes('edit')) {
                    this.subject = {} as SubjectModel;
                    var subjectId = this.url.split('/').pop() || '0';
                    this.subject.id = parseInt(subjectId);
                    this.loading = true;
                    this.subject = await this.datasourcesApiService
                        .getSubjectById(this.subject.id)
                        .then((response: any) => response.json())
                        .catch((error: any) => {
                            console.error('Error fetching subject:', error);
                            return null;
                        });
                    this.loading = false;
                }
            });
        } else {
            this.savedSubject = false;
            this.showSubjectForm = true;
            this.subject = {
                id: 0,
                id_study: this.url.includes('id_study')
                    ? parseInt(this.url.split('id_study=')[1] || '0')
                    : null,
                subject_id: '',
                synthetic: false,
                species: {} as OntologyModel,
                diagnosis: [] as DiagnosisModel[],
            } as SubjectModel;
        }

        this.getStudies();
        this.getSamples();
        this.getGenotypes();
        this.getSubjects();

        sessionStorage.setItem('loaded', false.toString());
    }

    goToSampleCreate(subject_id: number) {
        this.router.navigate([
            '/repository/create-sample',
            {
                id_study: this.subject?.id_study,
                id_subject: subject_id,
            },
        ]);
    }

    onDiseaseSelected(term: DiseaseTerm | null, index: number): void {
        if (
            !this.subject ||
            !this.subject.diagnosis ||
            index >= this.subject.diagnosis.length
        ) {
            return;
        }

        const diagnosis = this.subject.diagnosis[index];
        if (!diagnosis) return;

        if (term) {
            this.selectedDisease = term;
            this.diseaseDisplayText = `${term.label} (${term.id})`;
            diagnosis.disease_diagnosis = {
                id: term.id,
                label: term.label,
            };
        } else {
            this.selectedDisease = null;
            this.diseaseDisplayText = '';
            diagnosis.disease_diagnosis = { id: '', label: '' };
        }

        this.cdr.detectChanges();
    }

    getSpeciesDisplayText(species: any): string {
        if (!species) return '';
        return species.label && species.id
            ? `${species.label} (${species.id})`
            : species.label || '';
    }

    getDiseaseDisplayText(disease: any): string {
        if (!disease) return '';
        return disease.label && disease.id
            ? `${disease.label} (${disease.id})`
            : disease.label || '';
    }

    selectedOrganismGroupForAllelePicker: string | undefined;

    @ViewChild('allelePicker') allelePicker!: AllelePickerComponent;

    onSpeciesSelected(term: SpeciesTerm | null): void {
        if (!this.subject) return;

        if (term) {
            this.selectedSpecies = term;
            this.speciesDisplayText = `${term.label} (${term.id})`;
            this.subject.species = {
                id: term.id,
                label: term.label,
            };

            const mhcGroup = this.getMHCGroup(term);
            if (mhcGroup) {
                this.selectedOrganismGroupForAllelePicker = mhcGroup;
            } else {
                this.selectedOrganismGroupForAllelePicker = undefined;
            }
        } else {
            this.selectedSpecies = null;
            this.speciesDisplayText = '';
            if (!this.subject) return;
            this.subject.species = { id: '', label: '' };
            this.selectedOrganismGroupForAllelePicker = undefined;
        }

        this.cdr.detectChanges();
    }

    getMHCGroup(species: SpeciesTerm): string | null {
        const nonMHCIds = [
            'NCBITaxon:7227',
            'NCBITaxon:6239',
            'NCBITaxon:4932',
            'NCBITaxon:562',
        ];

        if (nonMHCIds.includes(species.id)) {
            return null;
        }

        if (this.directMappings[species.id]) {
            return this.directMappings[species.id];
        }

        const parents = species.parents || [];

        if (parents.includes('NCBITaxon:9443')) {
            return 'NHP';
        }

        if (parents.includes('NCBITaxon:9608')) {
            return 'DLA';
        }

        if (parents.includes('NCBITaxon:9935')) {
            return 'CLA';
        }

        if (parents.includes('NCBITaxon:9895')) {
            return 'BoLA';
        }

        if (parents.includes('NCBITaxon:9821')) {
            return 'SLA';
        }

        if (parents.includes('NCBITaxon:8782')) {
            return 'CHICKEN';
        }

        if (parents.includes('NCBITaxon:9989')) {
            return 'RT1';
        }

        if (parents.includes('NCBITaxon:8952')) {
            return 'FISH';
        }

        if (parents.includes('NCBITaxon:9788')) {
            return 'ELA';
        }

        if (parents.includes('NCBITaxon:9725')) {
            return 'CeLA';
        }

        return null;
    }

    importSamplesCSV() {
        var input = document.getElementById(
            'input-import-samples-csv',
        ) as HTMLInputElement;
        input.click();
        input.onchange = (event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                this.datasourcesApiService
                    .importSamplesCSV(
                        file,
                        this.subject?.id_study,
                        this.subject?.id,
                    )
                    .then((response: any) => {
                        const parsedErrors =
                            this.parseSampleImportErrors(response);

                        // Check if there are any issues
                        const hasIssues =
                            parsedErrors.duplicates.length > 0 ||
                            parsedErrors.missingSubjects.length > 0 ||
                            parsedErrors.ontologyErrors.length > 0 ||
                            parsedErrors.formatErrors.length > 0 ||
                            parsedErrors.validationErrors.length > 0 ||
                            parsedErrors.otherErrors.length > 0;

                        if (hasIssues) {
                            let message = '';

                            // Handle duplicate samples
                            if (parsedErrors.duplicates.length > 0) {
                                const duplicateIds =
                                    parsedErrors.duplicates.join(', ');
                                message += `${parsedErrors.duplicates.length} sample(s) were not imported because the following IDs already exist: ${duplicateIds}. `;
                            }

                            // Handle missing/invalid subjects
                            if (parsedErrors.missingSubjects.length > 0) {
                                const missingIds =
                                    parsedErrors.missingSubjects.join(', ');
                                message += `${parsedErrors.missingSubjects.length} sample(s) were not imported because the following subject IDs were not found: ${missingIds}. `;
                            }

                            // Handle ontology errors
                            if (parsedErrors.ontologyErrors.length > 0) {
                                message += `${parsedErrors.ontologyErrors.length} sample(s) have incorrectly formatted tissue or cell_subset fields. Use format 'label (ID)' like 'blood (UBERON:0000178)'. `;

                                // Show first few ontology errors for debugging
                                const firstErrors =
                                    parsedErrors.ontologyErrors.slice(0, 2);
                                if (firstErrors.length > 0) {
                                    message += `Examples: ${firstErrors.join('; ')}`;
                                    if (
                                        parsedErrors.ontologyErrors.length > 2
                                    ) {
                                        message += ` and ${parsedErrors.ontologyErrors.length - 2} more.`;
                                    }
                                }
                            }

                            // Handle format errors (wrong number of columns)
                            if (parsedErrors.formatErrors.length > 0) {
                                message += `${parsedErrors.formatErrors.length} sample(s) have the wrong number of columns. Expected 8 fields per row. `;

                                // Show first few format errors
                                const firstErrors =
                                    parsedErrors.formatErrors.slice(0, 2);
                                if (firstErrors.length > 0) {
                                    message += `Examples: ${firstErrors.join('; ')}`;
                                    if (parsedErrors.formatErrors.length > 2) {
                                        message += ` and ${parsedErrors.formatErrors.length - 2} more.`;
                                    }
                                }
                            }

                            // Handle validation errors
                            if (parsedErrors.validationErrors.length > 0) {
                                message += `${parsedErrors.validationErrors.length} validation error(s) occurred. `;

                                // Show first few validation errors
                                const firstErrors =
                                    parsedErrors.validationErrors.slice(0, 2);
                                if (firstErrors.length > 0) {
                                    message += `Details: ${firstErrors.join('; ')}`;
                                    if (
                                        parsedErrors.validationErrors.length > 2
                                    ) {
                                        message += ` and ${parsedErrors.validationErrors.length - 2} more.`;
                                    }
                                }
                            }

                            // Handle subject errors
                            if (parsedErrors.subjectErrors.length > 0) {
                                message += `${parsedErrors.subjectErrors.length} subject association error(s) occurred. `;

                                // Show first few subject errors
                                const firstErrors =
                                    parsedErrors.subjectErrors.slice(0, 2);
                                if (firstErrors.length > 0) {
                                    message += `Details: ${firstErrors.join('; ')}`;
                                    if (parsedErrors.subjectErrors.length > 2) {
                                        message += ` and ${parsedErrors.subjectErrors.length - 2} more.`;
                                    }
                                }
                            }

                            // Handle other errors
                            if (parsedErrors.otherErrors.length > 0) {
                                message += `${parsedErrors.otherErrors.length} unexpected error(s) occurred. First error: ${parsedErrors.otherErrors[0]}`;
                                console.error(
                                    'Sample import unexpected errors:',
                                    parsedErrors.otherErrors,
                                );
                            }

                            // If there were only errors and no specific message was built
                            if (!message) {
                                message = `Import completed with ${response.errors?.length || 0} error(s). Please check the console for details.`;
                            }

                            this.toastService.displayMessage(
                                message,
                                ToastType.WARNING,
                            );
                        } else {
                            // Success - no errors
                            this.toastService.displayMessage(
                                `Successfully imported ${response.imported_count || 0} sample(s).`,
                                ToastType.SUCCESS,
                            );
                        }

                        this.getSamples();
                    })
                    .catch((error: Error) => {
                        console.error('Error importing samples CSV:', error);
                        this.toastService.displayMessage(
                            'Error importing samples CSV. Please try again.',
                            ToastType.ERROR,
                        );
                    });
            }
        };
    }

    /**
     * Parse sample import errors into categories for better user feedback
     */
    private parseSampleImportErrors(response: any): {
        duplicates: string[];
        missingSubjects: string[];
        subjectErrors: string[];
        ontologyErrors: string[];
        formatErrors: string[];
        validationErrors: string[];
        otherErrors: string[];
    } {
        // Get duplicates and missing subjects from the structured response
        const duplicates: string[] = response.duplicate_sample_ids || [];
        const missingSubjects: string[] = response.missing_subjects || [];

        // Arrays for different error categories
        const subjectErrors: string[] = [];
        const ontologyErrors: string[] = [];
        const formatErrors: string[] = [];
        const validationErrors: string[] = [];
        const otherErrors: string[] = [];

        // If there are errors in the response, categorize them
        if (response.errors && Array.isArray(response.errors)) {
            response.errors.forEach((error: string) => {
                // Skip errors that are already handled by structured fields
                if (error.includes('already exists')) {
                    // Already handled by duplicate_sample_ids
                    return;
                } else if (
                    error.includes('not found in study') ||
                    error.includes('does not belong') ||
                    error.includes('not found')
                ) {
                    // Already handled by missing_subjects
                    return;
                } else if (
                    error.includes('subject_id is required') ||
                    error.includes('subject with id') ||
                    error.includes('does not belong to the selected study') ||
                    (error.includes('subject ID') &&
                        error.includes('not found'))
                ) {
                    subjectErrors.push(error);
                } else if (
                    error.includes("object has no attribute 'label'") ||
                    error.includes("object has no attribute 'id'") ||
                    (error.includes('tissue') && error.includes('format')) ||
                    (error.includes('cell_subset') &&
                        error.includes('format')) ||
                    error.includes('ontology')
                ) {
                    ontologyErrors.push(error);
                } else if (
                    error.includes('expected 8 fields') ||
                    error.includes('expected 7 fields') ||
                    error.includes('expected 6 fields') ||
                    error.includes('insufficient fields') ||
                    error.includes('wrong number of columns') ||
                    (error.includes('expected') && error.includes('fields'))
                ) {
                    formatErrors.push(error);
                } else if (
                    error.includes('invalid') ||
                    error.includes('required') ||
                    error.includes('format') ||
                    error.includes('empty') ||
                    error.includes('must be') ||
                    error.includes('cannot be') ||
                    error.includes('should be') ||
                    error.includes('valid') ||
                    error.includes('ValidationError')
                ) {
                    validationErrors.push(error);
                } else {
                    otherErrors.push(error);
                }
            });
        }

        return {
            duplicates,
            missingSubjects,
            subjectErrors,
            ontologyErrors,
            formatErrors,
            validationErrors,
            otherErrors,
        };
    }

    checkDuplicateSubjectId(): boolean {
        if (!this.subject || !this.subject.id_study) return false;

        const duplicate = this.subjects.some(
            (s) =>
                s.id_study === this.subject?.id_study &&
                s.subject_id === this.subject?.subject_id &&
                s.id !== this.subject?.id,
        );

        if (duplicate) {
            this.toastService.displayMessage(
                `Subject ID "${this.subject.subject_id}" already exists in this study.`,
                ToastType.WARNING,
            );
            return true;
        }
        return false;
    }

    async getStudies() {
        this.studies = await this.datasourcesApiService
            .getStudies()
            .then((response: any) => {
                return response.json();
            })
            .then((studies: StudyModel[]) => {
                return studies;
            });
    }

    subjects: SubjectModel[] = [];
    async getSubjects() {
        this.subjects = await this.datasourcesApiService
            .getSubjects()
            .then((response: any) => {
                return response.json();
            })
            .then((subjects: SubjectModel[]) => {
                return subjects;
            });
    }

    async getGenotypes() {
        this.mhc_genotype_list = await this.datasourcesApiService
            .getGenotypesBySubjectId(this.subject?.id || 0)
            .then((response: any) => {
                return response.json();
            });

        this.getAlleles();
    }

    getAlleles() {
        this.alleles = this.mhc_genotype_list.map((g: GenotypeModel) => g.name);
    }

    async saveTimepoint(timepoint: TimepointModel) {
        try {
            this.loading = true;

            const freshSubjects = await this.datasourcesApiService
                .getSubjects()
                .then((r: any) => {
                    return r.json();
                });

            const subjectExists = freshSubjects.some(
                (s: any) => s.id === timepoint.id_subject,
            );

            if (!subjectExists) {
                this.toastService.displayMessage(
                    `FATAL: Subject ID ${timepoint.id_subject} does not exist in database!`,
                    ToastType.ERROR,
                );
                this.loading = false;
                return;
            }

            const updatePayload = {
                id_subject: Number(timepoint.id_subject),
                id_relative_time_point:
                    timepoint.id_relative_time_point == null
                        ? null
                        : Number(timepoint.id_relative_time_point) + 0.0,
                time_point: Number(timepoint.time_point),
                units_of_measurement: String(timepoint.units_of_measurement),
                description: String(timepoint.description),
            };

            await this.datasourcesApiService
                .updateTimepoint(timepoint.id, updatePayload)
                .then(() => {
                    this.toastService.displayMessage(
                        'Timepoint saved successfully.',
                        ToastType.SUCCESS,
                    );
                    this.getSamples();
                })
                .catch((error: Error) => {
                    console.error('Error saving timepoint:', error);
                    this.toastService.displayMessage(
                        'Failed to save timepoint. Please try again later.',
                        ToastType.ERROR,
                    );
                });
        } finally {
            this.loading = false;
        }
    }

    async deleteTimepoint(timepoint_id: number) {
        try {
            this.loading = true;
            const confirmed = await this.modalService.confirm({
                title: 'Delete Timepoint',
                message: 'Are you sure you want to delete this timepoint?',
                type: 'confirm',
            });

            if (confirmed) {
                await this.datasourcesApiService
                    .deleteTimepoint(timepoint_id)
                    .then(() => {
                        this.toastService.displayMessage(
                            'Timepoint deleted successfully.',
                            ToastType.SUCCESS,
                        );
                        this.timepoints = this.timepoints.filter(
                            (tp) => tp.id !== timepoint_id,
                        );
                        this.updateDisplayTimepoints();
                        this.getSamples();
                    })
                    .catch((error: Error) => {
                        console.error('Error deleting timepoint:', error);
                        this.toastService.displayMessage(
                            'Failed to delete timepoint. Please try again later.',
                            ToastType.ERROR,
                        );
                    });
            }
        } finally {
            this.loading = false;
        }
    }

    associatedSamples: SampleModel[] = [];
    samplesLoaded: boolean = false;

    async getSamples() {
        this.loading = true;
        this.samples = await this.datasourcesApiService
            .getSamples()
            .then((response: any) => {
                return response.json();
            });
        this.associatedSamples = this.samples.filter(
            (sample) => sample.id_subject == this.subject?.id,
        );
        this.loading = false;
        this.samplesLoaded = true;
    }

    getAssociatedSamples(subject_id: number): SampleModel[] {
        return this.associatedSamples.filter(
            (sample) => sample.id_subject === subject_id,
        );
    }

    sampleUploadMap: { [key: string]: boolean } = {};

    async deleteSubject() {
        if (this.subject) {
            const confirmed = await this.modalService.confirm({
                title: 'Delete Subject',
                message:
                    'Are you sure you want to delete this subject? This action cannot be undone.',
                type: 'confirm',
            });

            if (confirmed) {
                this.datasourcesApiService
                    .deleteSubject(this.subject.id)
                    .then(() => {
                        this.toastService.displayMessage(
                            'Subject deleted successfully.',
                            ToastType.SUCCESS,
                        );
                        this.location.back();
                    })
                    .catch((error: Error) => {
                        console.error('Error deleting subject:', error);
                        this.toastService.displayMessage(
                            'Failed to delete subject. Please try again later.',
                            ToastType.ERROR,
                        );
                    });
            }
        }
    }

    showAlert() {
        if (
            this.subject?.subject_id == '' ||
            (this.subject?.diagnosis?.length == 1 &&
                (this.subject?.diagnosis[0]?.disease_diagnosis.id == '' ||
                    this.subject?.diagnosis[0]?.disease_diagnosis.label == '' ||
                    this.subject?.diagnosis[0]?.disease_stage == ''))
        ) {
            var alert = document.getElementById('form-alert');

            if (alert) {
                alert.innerHTML = this.getAlertString();
            }
            return true;
        }
        return false;
    }

    getAlertString() {
        var needed_elements: string[] = [];

        if (!this.subject?.id_study) {
            needed_elements.push('Study ID');
        }

        if (this.subject?.subject_id == '') {
            needed_elements.push('Subject ID');
        }

        if (
            this.subject?.diagnosis?.length == 1 &&
            (this.subject?.diagnosis[0]?.disease_diagnosis.id == '' ||
                this.subject?.diagnosis[0]?.disease_diagnosis.label == '' ||
                this.subject?.diagnosis[0]?.disease_stage == '')
        ) {
            needed_elements.push('Diagnosis');
        }

        if (needed_elements.length === 0) {
            return '';
        }

        if (needed_elements.length === 1) {
            return (
                'You must provide the following: <strong>' +
                needed_elements[0] +
                '</strong>.'
            );
        }

        const formattedElements = needed_elements.map(
            (n) => '<strong>' + n + '</strong>',
        );

        if (needed_elements.length === 2) {
            return (
                'You must provide the following: ' +
                formattedElements.join(' and ') +
                '.'
            );
        }

        const allButLast = formattedElements.slice(0, -1).join(', ');
        const lastElement = formattedElements[formattedElements.length - 1];

        return (
            'You must provide the following: ' +
            allButLast +
            ' and ' +
            lastElement +
            '.'
        );
    }

    async saveAllDiagnoses(): Promise<void> {
        if (!this.subject || !this.subject.diagnosis) {
            return;
        }

        if (this.subject.diagnosis) {
            for (let diagnosis of this.subject.diagnosis) {
                diagnosis.id_subject = this.subject.id;

                await this.datasourcesApiService
                    .updateDiagnosis(diagnosis.id, diagnosis)
                    .then(() => {
                    })
                    .catch((error: Error) => {
                        console.error('Error saving diagnosis:', error);
                    });
            }
        }
    }

    async saveSubject(redirect: boolean) {
        if (this.savedSubject) {
            this.toastService.displayMessage(
                'Subject completed successfully.',
                ToastType.SUCCESS,
            );
            this.location.back();
            return;
        }

        try {
            this.loading = true;

            if (this.subject?.subject_id.includes('|')) {
                this.modalService.alert({
                    title: 'Alert',
                    message: 'The subject ID cannot include the | symbol.',
                    type: 'alert',
                });
                return;
            }

            if (!this.subject) {
                throw new Error('Subject data is missing.');
            }

            if (!this.subject.id_study) {
                this.modalService.alert({
                    title: 'Alert',
                    message: 'Please select an associated study.',
                    type: 'alert',
                });
                return;
            }

            const { diagnosis, ...subjectPayload } = this.subject as any;

            let response;
            if (window.location.href.includes('create')) {
                response = await this.datasourcesApiService.createSubject(
                    subjectPayload as SubjectModel,
                );
                this.subject = response;
            } else {
                response = await this.datasourcesApiService.editSubject(
                    subjectPayload as SubjectModel,
                );
            }

            if (!response.ok) {
                const errorData = await response.json();
                if (
                    errorData.detail &&
                    errorData.detail.includes('already exists')
                ) {
                    const study = this.studies.find(
                        (s) => s.id === this.subject?.id_study,
                    );
                    const existingSubjectIds = this.subjects
                        .filter((s) => s.id_study === this.subject?.id_study)
                        .map((s) => s.subject_id);
                    const newId = this.idGeneratorService.generateSubjectId(
                        this.subject,
                        study?.study_id || 'STDY',
                        study,
                        existingSubjectIds,
                    );

                    const confirmed = await this.modalService.confirm({
                        title: 'Duplicate Subject ID',
                        message: `Subject ID "${this.subject?.subject_id}" already exists in this study. Would you like to use "${newId}" instead?`,
                        type: 'confirm',
                    });

                    if (confirmed && this.subject) {
                        this.subject.subject_id = newId;
                        this.saveSubject(redirect);
                    }
                    this.loading = false;
                    return;
                }

                throw new Error(errorData.detail || 'Failed to save subject');
            }

            if (response.status >= 200 && response.status < 300) {
                this.onCreate.emit(response);
                await this.saveAllDiagnoses();

                if (window.location.href.includes('create')) {
                    const responseData = await response.json();
                    this.subject = responseData;
                    this.savedSubject = true;
                    if (!this.subject) return;
                    this.selectedOrganismGroupForAllelePicker =
                        this.getMHCGroup(this.subject.species as SpeciesTerm) ||
                        undefined;
                    this.toastService.displayMessage(
                        'Subject saved successfully. You can now add alleles.',
                        ToastType.SUCCESS,
                    );
                } else {
                    this.toastService.displayMessage(
                        'Subject saved successfully.',
                        ToastType.SUCCESS,
                    );
                }
                this.cdr.detectChanges();
            }
        } catch (error: any) {
            this.onCreate.emit(null);
            this.onClose.emit();
            console.error('Error creating subject:', error);
            this.toastService.displayMessage(
                error.message || 'Failed to save subject, please try again.',
                ToastType.ERROR,
            );
        } finally {
            this.loading = false;
        }
    }

    get isSaveDisabled(): boolean {
        if (!this.subject) return true;
        if (this.subject.subject_id === '') return true;
        if (!this.subject.diagnosis) return true;
        return false;
    }

    hasValidSpecies(subject: any): boolean {
        return (
            subject?.species &&
            typeof subject.species === 'object' &&
            subject.species?.label &&
            subject.species?.id
        );
    }

    generateSubjectId() {
        const study = this.studies.find((s) => s.id === this.subject?.id_study);
        const existingSubjectIds = this.subjects
            .filter((s) => s.id_study === this.subject?.id_study)
            .map((s) => s.subject_id);
        const newId = this.idGeneratorService.generateSubjectId(
            this.subject,
            study?.study_id || 'STDY',
            study,
            existingSubjectIds,
        );

        if (this.subject) {
            this.subject.subject_id = newId;
        }
    }

    hasValidTissue(sample: any): boolean {
        return (
            sample?.tissue &&
            typeof sample.tissue === 'object' &&
            sample.tissue?.label &&
            sample.tissue?.id
        );
    }

    hasValidCellSubset(sample: any): boolean {
        return (
            sample?.cell_subset &&
            typeof sample.cell_subset === 'object' &&
            sample.cell_subset?.label &&
            sample.cell_subset?.id
        );
    }

    async onMhcChange(event: AlleleElement) {
        const a = event;

        var existing_mhc_list = this.mhc_genotype_list.map(
            (g) => g as GenotypeModel,
        );

        if (
            existing_mhc_list.some(
                (g: GenotypeModel) =>
                    g.name == a.name && g.mhc_class == a.mhc_class,
            )
        ) {
            return;
        }

        const response = await this.datasourcesApiService.addGenotypeToSubject(
            a as GenotypeModel,
            this.subject?.id || -1,
        );

        if (response) {
            if (response.json) {
                await response.json();
            }
        }

        this.getGenotypes();
    }

    async manualAdd(allele?: GenotypeModel) {
        if (allele && this.subject) {
            await this.datasourcesApiService
                .addGenotypeToSubject(allele, this.subject?.id)
                .then((allele: GenotypeModel) => {
                    this.getGenotypes();
                });
        }
    }

    isCreate() {
        if (this.router.url.includes('create')) {
            return true;
        }
        return false;
    }

    trackByDiagnosisId(index: number, item: any): any {
        return item.id || index;
    }

    getSubjectSamples(subjectId: number): SampleModel[] {
        return this.samples.filter((sample) => sample.id_subject === subjectId);
    }

    getSampleIdFromTimepoint(timepoint: TimepointModel): string {
        const sample = this.samples.find(
            (s) => s.id_timepoint === timepoint.id,
        );
        return sample ? sample.sample_id : 'N/A';
    }

    getSampleFromTimepoint(timepoint: TimepointModel): SampleModel | undefined {
        return this.samples.find((s) => s.id_timepoint === timepoint.id);
    }

    goToSampleEdit(sample_id: number) {
        this.router.navigate(['/repository/edit-sample', sample_id]);
    }

    async removeDiagnosis(diagnosisId: number) {
        if (!this.subject || !this.subject.diagnosis) {
            return;
        }

        const diagnosis = this.subject.diagnosis.find(
            (d: any) => d.id === diagnosisId,
        );
        if (!diagnosis) {
            return;
        }

        diagnosis.id_subject = undefined;

        await this.datasourcesApiService
            .updateDiagnosis(diagnosisId, diagnosis)
            .then(() => {
                if (!this.subject || !this.subject.diagnosis) {
                    return;
                }
                this.toastService.displayMessage(
                    'Diagnosis removed successfully.',
                    ToastType.SUCCESS,
                );
                this.subject.diagnosis = this.subject.diagnosis.filter(
                    (diagnosis: any) => diagnosis.id !== diagnosisId,
                );
            });
    }

    async addDiagnosis() {
        if (!this.subject) {
            return;
        }

        var newDiagnosis = {
            disease_stage: '',
            disease_diagnosis: { id: '', label: '' },
            immunogen: '',
            id_subject: this.subject.id == 0 ? null : this.subject.id,
        };

        var diag: DiagnosisModel;
        await this.datasourcesApiService
            .createDiagnosis(newDiagnosis)
            .then((response: any) => {
                return response.json();
            })
            .then((createdDiagnosis: DiagnosisModel) => {
                if (!this.subject) {
                    return;
                }

                diag = createdDiagnosis;
                this.subject.diagnosis = [...this.subject.diagnosis, diag];
                this.cdr.detectChanges();
            })
            .catch((error: Error) => {
                console.error('Error creating diagnosis:', error);
                this.toastService.displayMessage(
                    'Failed to create diagnosis. Please try again later.',
                    ToastType.ERROR,
                );
            });
    }

    filters: [string, string][] = [];
    selectedFilter: string = '';
    filterInput: string = '';

    resetFilters() {
        this.filters = [];
    }

    removeFilter(filter: [string, string]) {
        this.filters = this.filters.filter(
            ([type, value]) => type !== filter[0] && value !== filter[1],
        );
    }

    addFilter() {
        if (!this.selectedFilter || !this.filterInput) {
            this.modalService.alert({
                title: 'Alert',
                message:
                    'Please select a filter type and enter a filter value.',
                type: 'alert',
            });
            return;
        }

        if (
            this.filters.some(([type, value]) => type === this.selectedFilter)
        ) {
            this.modalService.alert({
                title: 'Alert',
                message: 'This filter type has already been added.',
                type: 'alert',
            });
            return;
        }

        this.filters.push([this.selectedFilter, this.filterInput]);
        this.filterInput = '';
    }

    setRadioValue(value: string): void {
        if (!this.subject) {
            return;
        }

        this.subject.synthetic = value === 'true';
    }

    getFilteredAssociatedSamples(subject_id: number): SampleModel[] {
        let filteredSamples = this.getAssociatedSamples(subject_id);
        for (let [filterType, filterValue] of this.filters) {
            console.log(
                `Filtering samples by ${filterType.trimStart()} with value ${filterValue}`,
            );

            filteredSamples = filteredSamples.filter((sample) => {
                if (
                    !sample.cell_subset?.label ||
                    !sample.tissue?.label ||
                    !sample.cell_subset?.id ||
                    !sample.tissue?.id
                ) {
                    return false;
                }

                switch (filterType) {
                    case 'Sample ID':
                        return sample.sample_id
                            .toLowerCase()
                            .includes(filterValue.toLowerCase());
                    case 'Sample Type':
                        return sample.sample_type
                            ?.toLowerCase()
                            .includes(filterValue.toLowerCase());
                    case 'Tissue':
                        return (
                            sample.tissue?.label
                                .toLowerCase()
                                .includes(filterValue.toLowerCase()) ||
                            sample.tissue?.id.toString().includes(filterValue)
                        );
                    case 'Cell Subset':
                        return (
                            sample.cell_subset?.label
                                .toLowerCase()
                                .includes(filterValue.toLowerCase()) ||
                            sample.cell_subset?.id
                                .toString()
                                .includes(filterValue)
                        );
                    case 'Cell Phenotype':
                        return sample.cell_phenotype
                            ?.toLowerCase()
                            .includes(filterValue.toLowerCase());
                    case 'Sequencing Type':
                        return sample.sequencing_type
                            ?.toLowerCase()
                            .includes(filterValue.toLowerCase());
                    default: {
                        return true;
                    }
                }
            });
        }
        return filteredSamples;
    }

    downloadCSV() {
        if (!this.subject) {
            return;
        }

        this.datasourcesApiService
            .downloadSubjectCSV(this.subject.id)
            .then((response: any) => {
                return response.blob();
            })
            .then((blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `subject_${this.subject?.subject_id}_samples.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            });
    }

    alleles: string[] = [];

    async removeAllele(allele: AlleleElement) {
        if (!this.subject) {
            return;
        }

        var genotype = this.mhc_genotype_list.find(
            (g) => g.name.trim() === allele.name.trim(),
        );

        if (!genotype) {
            return;
        }

        await this.datasourcesApiService
            .deleteGenotype(genotype?.id)
            .then(async (response: any) => {
                await this.getGenotypes();
            });
    }

    isEditModeOn(): boolean {
        return Object.values(this.editMode).some((v) => v === true);
    }

    async getTimepoints() {
        if (!this.subject || this.subject.id === 0) {
            return [];
        }

        this.timepoints = await this.datasourcesApiService
            .getSubjectTimepoints(this.subject.id)
            .then((response: any) => {
                return response.json();
            });

        for (let timepoint of this.timepoints) {
            this.editMode[timepoint.id] = false;
        }

        this.updateDisplayTimepoints();
        return this.timepoints;
    }

    updateDisplayTimepoints() {
        this.displayTimepoints = [...this.timepoints].sort((a, b) => {
            if (
                a.id_relative_time_point == null &&
                b.id_relative_time_point == null
            )
                return 0;
            if (a.id_relative_time_point == null) return 1;
            if (b.id_relative_time_point == null) return -1;
            return a.id_relative_time_point - b.id_relative_time_point;
        });
    }

    onWheel(event: WheelEvent) {
        const container = event.currentTarget as HTMLElement;
        container.scrollLeft += event.deltaY;
        event.preventDefault();
    }

    directMappings: Record<string, string> = {
        'NCBITaxon:9606': 'HLA',
        'NCBITaxon:10090': 'RT1',
        'NCBITaxon:10116': 'RT1',
        'NCBITaxon:7955': 'OLA',
        'NCBITaxon:9913': 'BoLA',
        'NCBITaxon:9823': 'SLA',
        'NCBITaxon:9031': 'CHICKEN',
        'NCBITaxon:9615': 'DLA',
        'NCBITaxon:9685': 'DLA',
        'NCBITaxon:9544': 'NHP',
        'NCBITaxon:9598': 'NHP',
        'NCBITaxon:8364': 'FISH',
    };

    @ViewChild('item0') accordionItem: any;
    @ViewChild('alleleSection') alleleSection: any;
}
