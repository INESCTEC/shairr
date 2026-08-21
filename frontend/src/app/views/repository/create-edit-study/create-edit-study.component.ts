import { DefaultModalService } from 'src/services/default-modal.service';
import {
    Component,
    ElementRef,
    EventEmitter,
    Output,
    ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DataProcessingModel } from 'src/models/airr/data-processing.model';
import { SampleModel } from 'src/models/shairr/datasources/sample.model';
import { ToastType, ToastService } from 'src/services/toast.service';
import { DatasourcesApiService } from 'src/services/datasources-api.service';
import { ChangeDetectorRef } from '@angular/core';
import { DropdownComponent } from '@coreui/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatasetModel } from 'src/models/shairr/datasources/dataset.model';
import { StudyModel } from '../../../../models/shairr/datasources/study.model';
import { SubjectModel } from '../../../../models/shairr/datasources/subject.model';
import { TimepointModel } from '../../../../models/shairr/datasources/timepoint.model';
import { GenotypeModel } from '../../../../models/shairr/datasources/genotype.model';
import { Location } from '@angular/common';
import { IdGeneratorService } from '../../../../services/id-generator.service';
import { AllelePickerBulkComponent } from '../../widgets/allele-picker-bulk/allele-picker-bulk.component';
import { SpeciesTerm } from '../../../../models/shairr/datasources/species.model';
import { SpeciesOntologyService } from '../../../../services/species-api.service';
import { CalloutComponent } from '@coreui/angular';
import { OntologyModel } from '../../../../models/airr/ontology.model';
import { firstValueFrom } from 'rxjs/internal/firstValueFrom';

@Component({
    selector: 'app-create-edit-study',
    templateUrl: './create-edit-study.component.html',
    styleUrls: ['./create-edit-study.component.scss'],
    providers: [DropdownComponent, CalloutComponent],
})
export class CreateEditStudyComponent {
    @Output() onCreate = new EventEmitter<any>();
    @Output() onClose = new EventEmitter<void>();

    studyForm: any;
    info: any;
    loading: boolean = false;
    selectedAligners: any = {};
    subjects: SubjectModel[] = [];
    associatedSubjects: SubjectModel[] = [];
    samples: SampleModel[] = [];
    associatedSamples: SampleModel[] = [];
    filters: [string, string][] = [];
    selectedFilter: string = '';
    filterInput: string = '';
    mhc_genotype_list_by_subject: Record<number, GenotypeModel[]> = {};

    subjectTableOpen: { [key: number]: boolean } = {};

    url: string = '';

    readyToProcess = false;

    timelineSteps = [
        { label: 'Study', icon: 'cil-graph' },
        { label: 'Study', icon: 'cil-graph' },
        { label: 'Subject', icon: 'cil-chart' },
        { label: 'Samples', icon: 'cil-description' },
        { label: 'Timeline', icon: 'fa-solid fa-timeline' },
        { label: 'Processing', icon: 'cil-tasks' },
        { label: 'Annotated Datasets', icon: 'fa-solid fa-edit' },
    ];

    route: ActivatedRoute;
    constructor(
        private modalService: DefaultModalService,
        private idGeneratorService: IdGeneratorService,
        public router: Router,
        private activatedRoute: ActivatedRoute,
        private datasourcesApiService: DatasourcesApiService,
        private speciesApiService: SpeciesOntologyService,
        private toastService: ToastService,
        private cdr: ChangeDetectorRef,
        private location: Location,
    ) {
        this.cdr = cdr;
        this.router = router;
        this.activatedRoute = activatedRoute;
        this.url = window.location.href;
        this.datasourcesApiService = datasourcesApiService;
        this.toastService = toastService;
        this.route = activatedRoute;

        sessionStorage.setItem('loaded', false.toString());

        if (this.url.includes('edit')) {
            if (this.study == null && this.url.includes('edit')) {
                this.getStudy();
            }
        } else {
            this.study = {
                id: 0,
                study_id: '',
                study_description: '',
                study_title: '',
                contributors: '',
            } as StudyModel;
        }

        this.initialCall();
    }

    async initialCall() {
        await this.getStudies();
        await this.getSubjects();
        await this.getGenotypesBySubject();
        await this.getSubjectSpeciesFilter();
    }

    study: StudyModel | null = null;
    timepoints: TimepointModel[] = [];

    async getGenotypesBySubject() {
        this.mhc_genotype_list_by_subject = await this.datasourcesApiService
            .getGenotypesBySubject()
            .then((response: any) => {
                return response.json();
            });
    }

    getCurrentStudyId(): number | null {
        if (this.study && this.study.id) {
            return this.study.id;
        }
        if (this.url.includes('id_study')) {
            return parseInt(
                this.url.split('id_study=')[1]?.split('&')[0] || '0',
            );
        }
        return null;
    }

    goToSubjectCreate() {
        const studyId = this.getCurrentStudyId();
        const params: any = {};
        if (studyId) {
            params.id_study = studyId;
        }
        this.router.navigate(['/repository/create-subject', params]);
    }

    ngAfterViewChecked() {
        var all_lines = document.querySelectorAll("td[colspan='7']");

        all_lines.forEach((l) => l.setAttribute('colspan', '8'));
    }

    goToSampleCreate(subject_id: number) {
        const studyId = this.getCurrentStudyId();
        const params: any = {
            id_subject: subject_id,
        };
        if (studyId) {
            params.id_study = studyId;
        }
        this.router.navigate(['/repository/create-sample', params]);
    }

    @ViewChild('subjectsCsvInput')
    subjectsCsvInput!: ElementRef<HTMLInputElement>;
    @ViewChild('samplesCsvInput')
    samplesCsvInput!: ElementRef<HTMLInputElement>;

    importSubjectsCSV() {
        setTimeout(() => {
            this.subjectsCsvInput.nativeElement.value = '';
            this.subjectsCsvInput.nativeElement.click();
        });
    }

    onSubjectsCsvSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
        const file = target.files[0];
        if (this.study) {
            this.datasourcesApiService
                .importSubjectsCSV(file, this.study.id)
                .then(async (response: any) => {
                    // Check if there are any errors or duplicates
                    const hasErrors = response.errors && response.errors.length > 0;
                    const hasDuplicates = response.duplicate_ids && response.duplicate_ids.length > 0;
                    
                    if (hasErrors || hasDuplicates) {
                        let message = '';
                        
                        // Handle duplicate IDs from the structured response
                        if (hasDuplicates) {
                            const duplicateIds = response.duplicate_ids.join(', ');
                            message += `${response.duplicate_count} subjects were not imported because the following IDs already exist: ${duplicateIds}. `;
                        }
                        
                        // Handle other errors
                        if (hasErrors) {
                            // Filter out duplicate errors from the errors array to avoid double-counting
                            const otherErrors = response.errors.filter(
                                (error: string) => !error.includes('already exists')
                            );
                            
                            if (otherErrors.length > 0) {
                                message += `${otherErrors.length} other errors occurred. `;
                                
                                // Show first few errors for debugging
                                const firstErrors = otherErrors.slice(0, 3);
                                message += `First errors: ${firstErrors.join('; ')}`;
                                
                                if (otherErrors.length > 3) {
                                    message += ` and ${otherErrors.length - 3} more.`;
                                }
                                
                                console.error('Subject import errors:', otherErrors);
                            }
                        }
                        
                        // If there were only duplicates and no other errors
                        if (!message) {
                            message = 'Import completed with errors.';
                        }
                        
                        this.toastService.displayMessage(
                            message,
                            ToastType.WARNING,
                        );
                    } else {
                        this.toastService.displayMessage(
                            `Successfully imported ${response.imported_count || 0} subjects.`,
                            ToastType.SUCCESS,
                        );
                    }
                    await this.getSubjects();
                    await this.getGenotypesBySubject();
                })
                .catch((error: Error) => {
                    console.error('Error importing subjects CSV:', error);
                    this.toastService.displayMessage(
                        'Failed to import subjects. Please check the file format and try again.',
                        ToastType.ERROR,
                    );
                });
        }
    }
}

    importSamplesCSV(subject_id?: number) {
        setTimeout(() => {
            if (subject_id) {
                this.samplesCsvInput.nativeElement.value = '';
                this.samplesCsvInput.nativeElement.click();
            } else {
                if (
                    this.subjects.length != 0 &&
                    this.associatedSubjects.length != 0
                ) {
                    this.samplesCsvInput.nativeElement.value = '';
                    this.samplesCsvInput.nativeElement.click();
                } else {
                    this.toastService.displayMessage(
                        'You can only import samples if you have existing subjects.',
                        ToastType.ERROR,
                    );
                }
            }
        });
    }

    generateStudyId() {
        var existingStudyIds = this.studies.map((s) => s.study_id);
        const newId = this.idGeneratorService.generateStudyId(
            this.study,
            existingStudyIds,
        );

        if (this.study) {
            this.study.study_id = newId;
        }
    }

    onSamplesCsvSelected(event: Event, subject_id?: number) {
    const target = event?.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
        const file = target.files[0];
        if (this.study) {
            this.datasourcesApiService
                .importSamplesCSV(file, this.study?.id, subject_id)
                .then((response: any) => {
                    const parsedErrors = this.parseSampleImportErrors(response);
                    
                    // Check if there are any issues
                    const hasIssues = 
                        parsedErrors.duplicates.length > 0 ||
                        parsedErrors.missingSubjects.length > 0 ||
                        parsedErrors.subjectErrors.length > 0 ||
                        parsedErrors.ontologyErrors.length > 0 ||
                        parsedErrors.formatErrors.length > 0 ||
                        parsedErrors.validationErrors.length > 0 ||
                        parsedErrors.otherErrors.length > 0;
                    
                    if (hasIssues) {
                        let message = '';
                        
                        // Handle duplicate samples
                        if (parsedErrors.duplicates.length > 0) {
                            const duplicateIds = parsedErrors.duplicates.join(', ');
                            message += `${parsedErrors.duplicates.length} sample(s) were not imported because the following IDs already exist: ${duplicateIds}. `;
                        }
                        
                        // Handle missing/invalid subjects
                        if (parsedErrors.missingSubjects.length > 0) {
                            const missingIds = parsedErrors.missingSubjects.join(', ');
                            message += `${parsedErrors.missingSubjects.length} sample(s) were not imported because the following subject IDs were not found in the study: ${missingIds}. `;
                        }
                        
                        // Handle subject errors (required, not found, doesn't belong)
                        if (parsedErrors.subjectErrors.length > 0) {
                            message += `${parsedErrors.subjectErrors.length} sample(s) have invalid subject associations. `;
                            
                            // Show first few subject errors for debugging
                            const firstErrors = parsedErrors.subjectErrors.slice(0, 2);
                            message += `Details: ${firstErrors.join('; ')}`;
                            
                            if (parsedErrors.subjectErrors.length > 2) {
                                message += ` and ${parsedErrors.subjectErrors.length - 2} more.`;
                            }
                        }
                        
                        // Handle ontology errors
                        if (parsedErrors.ontologyErrors.length > 0) {
                            message += `${parsedErrors.ontologyErrors.length} sample(s) have incorrectly formatted tissue or cell_subset fields. Use format 'label (ID)' like 'blood (UBERON:0000178)'. `;
                            
                            // Show first few ontology errors
                            const firstErrors = parsedErrors.ontologyErrors.slice(0, 2);
                            message += `Examples: ${firstErrors.join('; ')}`;
                            
                            if (parsedErrors.ontologyErrors.length > 2) {
                                message += ` and ${parsedErrors.ontologyErrors.length - 2} more.`;
                            }
                        }
                        
                        // Handle format errors (wrong number of columns)
                        if (parsedErrors.formatErrors.length > 0) {
                            message += `${parsedErrors.formatErrors.length} sample(s) have the wrong number of columns. Expected 8 fields per row. `;
                            
                            // Show first few format errors
                            const firstErrors = parsedErrors.formatErrors.slice(0, 2);
                            message += `Examples: ${firstErrors.join('; ')}`;
                            
                            if (parsedErrors.formatErrors.length > 2) {
                                message += ` and ${parsedErrors.formatErrors.length - 2} more.`;
                            }
                        }
                        
                        // Handle validation errors
                        if (parsedErrors.validationErrors.length > 0) {
                            message += `${parsedErrors.validationErrors.length} validation error(s) occurred. `;
                            
                            // Show first few validation errors
                            const firstErrors = parsedErrors.validationErrors.slice(0, 2);
                            message += `Details: ${firstErrors.join('; ')}`;
                            
                            if (parsedErrors.validationErrors.length > 2) {
                                message += ` and ${parsedErrors.validationErrors.length - 2} more.`;
                            }
                        }
                        
                        // Handle other errors
                        if (parsedErrors.otherErrors.length > 0) {
                            message += `${parsedErrors.otherErrors.length} unexpected error(s) occurred. First error: ${parsedErrors.otherErrors[0]}`;
                            console.error('Sample import unexpected errors:', parsedErrors.otherErrors);
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
                        'Failed to import samples. Please check the file format and try again.',
                        ToastType.ERROR,
                    );
                });
        }
    }
}

/**
 * Parse sample import errors into categories for better user feedback
 */
private parseSampleImportErrors(response: any): { 
    duplicates: string[], 
    missingSubjects: string[],
    subjectErrors: string[],
    ontologyErrors: string[],
    formatErrors: string[],
    validationErrors: string[], 
    otherErrors: string[] 
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
            } else if (error.includes('not found in study') || 
                       error.includes('does not belong')) {
                // Already handled by missing_subjects
                return;
            } else if (
                error.includes('subject_id is required') ||
                error.includes('subject with id') ||
                error.includes('does not belong to the selected study') ||
                error.includes('subject ID') && error.includes('not found')
            ) {
                subjectErrors.push(error);
            } else if (
                error.includes("object has no attribute 'label'") ||
                error.includes("object has no attribute 'id'") ||
                error.includes('tissue') && error.includes('format') ||
                error.includes('cell_subset') && error.includes('format')
            ) {
                ontologyErrors.push(error);
            } else if (
                error.includes('expected 8 fields') ||
                error.includes('insufficient fields') ||
                error.includes('expected 7 fields') ||
                error.includes('wrong number of columns')
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
                error.includes('valid')
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
        otherErrors 
    };
}

    getAlleles(subject_id: number) {
        if (!this.mhc_genotype_list_by_subject[subject_id]) {
            return [];
        }
        return this.mhc_genotype_list_by_subject[subject_id].map((g) => g.name);
    }

    studies: StudyModel[] = [];

    async getStudies() {
        this.loading = true;
        this.studies = [];
        this.studies = await this.datasourcesApiService
            .getStudies()
            .then((response: any) => {
                return response.json();
            });
        this.loading = false;
    }

    async getStudy() {
        this.study = {} as StudyModel;
        var studyId = this.url.split('/').pop();
        this.study.id = parseInt(studyId || '0');
        this.loading = true;
        this.study = await this.datasourcesApiService
            .getStudyById(this.study.id)
            .then((response: any) => {
                return response.json();
            });
        this.loading = false;
    }

    async getSubjects() {
        this.loading = true;
        this.subjects = await this.datasourcesApiService
            .getSubjects()
            .then((response: any) => {
                return response.json();
            });
        this.associatedSubjects = await this.subjects.filter(
            (subject) => subject.id_study === this.study?.id,
        );
        this.loading = false;
        await this.getSamples();
        await this.getTimepoints();
    }

    async getTimepoints() {
        this.loading = true;

        if (this.associatedSubjects.length == 0 || this.subjects.length == 0) {
            this.timepoints = [];
            this.loading = false;
            return;
        }
        this.timepoints = await this.datasourcesApiService
            .getTimepointsBySubject(
                this.associatedSubjects.map((subject) => subject.id),
            )
            .then((response: any) => {
                return response.json();
            });
        this.loading = false;
    }

    samplesLoaded: boolean = false;

    async getSamples() {
        this.loading = true;
        this.samples = await this.datasourcesApiService
            .getSamples()
            .then((response: any) => {
                return response.json();
            });
        var associatedSubjectsIds = this.associatedSubjects.map(
            (subject: SubjectModel) => subject.id,
        );
        this.associatedSamples = this.samples.filter((sample) =>
            associatedSubjectsIds.includes(sample.id_subject),
        );
        this.loading = false;
        this.samplesLoaded = true;
    }

    getAssociatedSamples(subject_id: number): SampleModel[] {
        return this.associatedSamples.filter(
            (sample) => sample.id_subject === subject_id,
        );
    }

    seeSubjectSamples(subject_id: number) {
        this.subjectTableOpen[subject_id] = !this.subjectTableOpen[subject_id];
    }

    goToSampleEdit(sample_id: number) {
        const studyId = this.getCurrentStudyId();
        const params: any = {};
        if (studyId) {
            params.id_study = studyId;
        }
        this.router.navigate(['/repository/edit-sample', sample_id, params]);
    }

    isSubjectFilter(filterType: string): boolean {
        const subjectFilters = [
            'Subject ID',
            'Synthetic',
            'Species',
            'MHC Genotype List',
        ];
        return subjectFilters.includes(filterType);
    }

    generateLigoSamples() {
        this.router.navigate(['/datasources/generate']);
    }

    isCreate() {
        if (this.router.url.includes('create')) {
            return true;
        }
        return false;
    }

    downloadSubjectsCSV() {
        this.datasourcesApiService
            .downloadSubjectsCSVFromStudy(this.study?.id)
            .then((response: any) => {
                return response.blob();
            })
            .then((blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = this.study?.study_id + '_subjects.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            })
            .catch((error: Error) => {
                console.error('Error downloading subjects CSV:', error);
                this.toastService.displayMessage(
                    'Failed to download subjects CSV. Please try again later.',
                    ToastType.ERROR,
                );
            });
    }

    downloadSamplesCSV(subject_id: Number) {
        this.datasourcesApiService
            .downloadSamplesCSVFromSubject(subject_id)
            .then((response: any) => {
                return response.blob();
            })
            .then((blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = this.study?.study_id + '_samples.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            })
            .catch((error: Error) => {
                console.error('Error exporting samples CSV:', error);
                this.toastService.displayMessage(
                    'Failed to export samples CSV. Please try again later.',
                    ToastType.ERROR,
                );
            });
    }

    downloadStudySamplesCSV() {
        this.datasourcesApiService
            .downloadSamplesCSVFromStudy(this.study?.id)
            .then((response: any) => {
                return response.blob();
            })
            .then((blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = this.study?.study_id + '_samples.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            })
            .catch((error: Error) => {
                console.error('Error exporting samples CSV:', error);
                this.toastService.displayMessage(
                    'Failed to export samples CSV. Please try again later.',
                    ToastType.ERROR,
                );
            });
    }

    async removeSubject(subject_id: number) {
        if (
            await this.modalService.confirm({
                title: 'Confirm',
                message:
                    'You are going to delete subject of ID ' +
                    subject_id +
                    '. This is irreversible, are you sure?',
                type: 'confirm',
            })
        ) {
            await this.datasourcesApiService
                .deleteSubject(subject_id)
                .then((response: any) => {
                    this.getSubjects();
                    this.getSamples();
                    this.getStudy();
                    this.cdr.detectChanges();
                });
        }
    }

    async removeSample(sample_id: number) {
        if (
            await this.modalService.confirm({
                title: 'Confirm',
                message:
                    'You are going to delete sample of ID ' +
                    sample_id +
                    '. This is irreversible, are you sure?',
                type: 'confirm',
            })
        ) {
            await this.datasourcesApiService
                .deleteSample(sample_id)
                .then((response: any) => {
                    this.getSubjects();
                    this.getSamples();
                    this.getStudy();
                    this.cdr.detectChanges();
                });
        }
    }

    idDatasets: number[] = [];

    importFile(annotated: boolean, sample_id: number) {
        const fileInput = document.getElementById(
            'processing-file-input',
        ) as HTMLInputElement;

        if (!fileInput) {
            console.error('File input element not found');
            return;
        }

        if (annotated) {
            fileInput.accept = '.tsv';
        } else {
            fileInput.accept = '.fastq.gz';
        }

        fileInput.click();

        var files: File[] = [];
        fileInput.onchange = (event) => {
            const target = event.target as HTMLInputElement;

            if (target.files && target.files.length > 0) {
                for (let i = 0; i < target.files.length; i++) {
                    const file = target.files[i];
                    files.push(file);

                    if (!annotated) {
                    }
                }

                this.datasourcesApiService
                    .uploadFile(files, annotated)
                    .then(async (response: any) => {
                        this.toastService.displayMessage(
                            'File uploaded successfully.',
                            ToastType.SUCCESS,
                        );
                        response.forEach((dataset: any) => {
                            this.idDatasets.push(dataset.id);
                        });
                    });
                this.toastService.displayMessage(
                    'File upload started.',
                    ToastType.INFO,
                );
            }
        };
    }

    ngAfterViewInit() {
        this.buildSampleTimeline();
    }

    directMappings: Record<string, string> = {
        'NCBITaxon:9606': 'HLA',
        'NCBITaxon:10090': 'RT1', // Changed from 'H2' to 'RT1'
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

    async saveStudy(redirect: boolean) {
        try {
            var response;

            this.loading = true;

            if (!this.study) {
                throw new Error('Study data is missing.');
            }

            if (this.study?.study_id.includes('|')) {
                this.modalService.alert({
                    title: 'Alert',
                    message: 'The study ID cannot include the | symbol.',
                    type: 'alert',
                });
                return;
            }

            if (window.location.href.includes('create')) {
                response = await this.datasourcesApiService.createStudy(
                    this.study,
                );
            } else if (!window.location.href.includes('create')) {
                response = await this.datasourcesApiService.editStudy(
                    this.study,
                );
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw { status: response.status, error: errorData };
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            if (response.status >= 200 && response.status < 300) {
                this.toastService.displayMessage(
                    'Study saved successfully.',
                    ToastType.SUCCESS,
                );
                this.onCreate.emit(response);
                this.getStudy();
            }

            if (this.router.url.includes('create')) {
                this.location.back();
            }
        } catch (error: any) {
            this.onCreate.emit(null);
            this.onClose.emit();

            var existingStudyIds = this.studies.map((s) => s.study_id);
            if (error.error?.detail?.includes('already exists')) {
                const newId = this.idGeneratorService.generateStudyId(
                    this.study,
                    [],
                );

                this.modalService
                    .confirm({
                        title: 'Duplicate Study ID',
                        message: `Study ID "${this.study?.study_id}" already exists. Would you like to use "${newId}" instead?`,
                        type: 'confirm',
                    })
                    .then((result) => {
                        if (result && this.study) {
                            this.study.study_id = newId;
                            this.saveStudy(redirect);
                        }
                    });
            } else {
                console.error('Error creating study:', error);
                this.toastService.displayMessage(
                    'Failed to save study, please try again.',
                    ToastType.ERROR,
                );
            }
        } finally {
            this.loading = false;
        }
    }

    hasValidSpecies(subject: any): boolean {
        return (
            subject?.species &&
            typeof subject.species === 'object' &&
            subject.species?.label &&
            subject.species?.id
        );
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

    buildSampleTimeline() {
        var samples = [];
        var sampleGroups: Record<string, SampleModel[]> = {};
        for (let sampleGroup of Object.entries(sampleGroups)) {
            const groupKey = sampleGroup[0];
            const samples = sampleGroup[1];
            const lineCount = samples.length - 1;

            const sampleTimeline = document.getElementById(
                `sample-timeline-${groupKey}`,
            );

            for (let i = 0; i < lineCount; i++) {
                const hrDiv = document.createElement('div');
                hrDiv.setAttribute('class', 'col');
                const hr = document.createElement('hr');
                hr.style.height = '15px';
                hr.style.width = '250px';
                hr.style.marginLeft = '-100px';
                hr.style.alignSelf = 'top';
                hr.style.color = '#2356a2';
                hr.style.minHeight = '15px';
                hr.style.maxHeight = '15px';
                hrDiv.appendChild(hr);

                document
                    .getElementById(`sample-timepoint-${samples[i].id}`)
                    ?.insertAdjacentElement('afterend', hrDiv);
                console.error(
                    `Failed to insert horizontal line after sample timepoint ${
                        samples[(i + 1) % samples.length].id
                    }`,
                );

                document
                    .getElementById(`sample-timepoint-${samples[i + 1].id}`)
                    ?.style.setProperty('margin-left', '-125px');
            }
        }
    }

    goToSubjectEdit(subject_id: number) {
        const studyId = this.getCurrentStudyId();
        const params: any = {};
        if (studyId) {
            params.id_study = studyId;
        }
        this.router.navigate(['/repository/edit-subject', subject_id, params]);
    }

    isFirstTimepoint(timepoints: any[], currentTp: any): boolean {
        const sortedTimepoints = [...timepoints].sort(
            (a, b) => a.time_point - b.time_point,
        );
        return sortedTimepoints[0] === currentTp;
    }

    getLineWidth(
        timepoints: any[],
        currentColIndex: number,
        columns: number[],
    ): number {
        const timepointColIndices = timepoints
            .map((tp) => columns.indexOf(tp.time_point))
            .filter((index) => index !== -1)
            .sort((a, b) => a - b);

        const currentColHasTimepoint =
            timepointColIndices.includes(currentColIndex);
        if (!currentColHasTimepoint) return 0;

        const previousTimepointColIndex = timepointColIndices
            .filter((index) => index < currentColIndex)
            .pop();

        if (previousTimepointColIndex === undefined) return 0;

        const cellsBetween = currentColIndex - previousTimepointColIndex;

        return cellsBetween * 165;
    }

    getLineLeftOffset(
        timepoints: any[],
        currentColIndex: number,
        columns: number[],
    ): number {
        const timepointColIndices = timepoints
            .map((tp) => columns.indexOf(tp.time_point))
            .filter((index) => index !== -1)
            .sort((a, b) => a - b);

        const currentColHasTimepoint =
            timepointColIndices.includes(currentColIndex);
        if (!currentColHasTimepoint) return 0;

        const previousTimepointColIndex = timepointColIndices
            .filter((index) => index < currentColIndex)
            .pop();

        if (previousTimepointColIndex === undefined) return 0;

        const cellsBetween = currentColIndex - previousTimepointColIndex;

        return -(165 / 2) - (cellsBetween - 1) * 165;
    }

    shouldDrawLine(
        timepoints: any[],
        currentColIndex: number,
        columns: number[],
    ): boolean {
        const timepointColIndices = timepoints
            .map((tp) => columns.indexOf(tp.time_point))
            .filter((index) => index !== -1)
            .sort((a, b) => a - b);

        const currentColHasTimepoint =
            timepointColIndices.includes(currentColIndex);

        if (!currentColHasTimepoint) return false;

        const previousTimepointColIndex = timepointColIndices
            .filter((index) => index < currentColIndex)
            .pop();

        return previousTimepointColIndex !== undefined;
    }

    resetFilters() {
        this.filters = [];
    }

    removeFilter(filter: [string, string]) {
        this.filters = this.filters.filter(
            ([type, value]) => type !== filter[0] && value !== filter[1],
        );
    }

    addFilter() {
        if (
            !(
                this.selectedFilter == 'Synthetic' ||
                this.selectedFilter == 'Organic'
            )
        ) {
            if (!this.selectedFilter || !this.filterInput) {
                this.modalService.alert({
                    title: 'Alert',
                    message:
                        'Please select a filter type and enter a filter value.',
                    type: 'alert',
                });
                return;
            }
        }

        if (
            this.filters.some(
                ([type, value]) => type === this.selectedFilter,
            ) ||
            (this.selectedFilter === 'Synthetic' &&
                this.filters.some(([type, value]) => type === 'Organic')) ||
            (this.selectedFilter === 'Organic' &&
                this.filters.some(([type, value]) => type === 'Synthetic'))
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

    getFilteredSubjects(): SubjectModel[] {
        let filteredSubjects = this.associatedSubjects;

        for (let [filterType, filterValue] of this.filters) {
            filteredSubjects = filteredSubjects.filter((subject) => {
                switch (filterType) {
                    case 'Subject ID':
                        return subject.subject_id
                            .toLowerCase()
                            .includes(filterValue.toLowerCase());
                    case 'Synthetic': {
                        return subject.synthetic;
                    }
                    case 'Organic': {
                        return !subject.synthetic;
                    }
                    case 'Species':
                        if (!subject.species) {
                            return false;
                        }
                        if (!subject.species.label || !subject.species.id) {
                            return false;
                        }
                        return (
                            subject.species.label
                                .toLowerCase()
                                .includes(filterValue.toLowerCase()) ||
                            subject.species.id.toString().includes(filterValue)
                        );
                    case 'MHC Genotype List':
                        return this.mhc_genotype_list_by_subject[
                            subject.id
                        ].some((g) =>
                            g.name.includes(filterValue.toLowerCase()),
                        );
                    default: {
                        return true;
                    }
                }
            });
        }

        return filteredSubjects;
    }

    getFilteredAssociatedSamples(subject_id: number): SampleModel[] {
        let filteredSamples = this.getAssociatedSamples(subject_id);
        for (let [filterType, filterValue] of this.filters) {
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
        if (!this.study) {
            return;
        }

        this.datasourcesApiService
            .downloadStudyCSV(this.study.id)
            .then((response: any) => {
                return response.blob();
            })
            .then((blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `study_${this.study?.id}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            });
    }

    getTimelineViewCols() {
        var timepoints = new Set(this.timepoints.map((tp) => tp.time_point));
        return Array.from(timepoints).sort((a, b) => a - b);
    }

    getTimepointsBySubject() {
        var subjectTimepoints: [SubjectModel, TimepointModel[]][] = [];

        if (
            this.associatedSubjects.length == 0 ||
            this.timepoints.length == 0
        ) {
            return [];
        }

        for (let subject of this.associatedSubjects) {
            var tps = this.timepoints.filter(
                (tp) => tp.id_subject === subject.id,
            );
            subjectTimepoints.push([subject, tps]);
        }
        return subjectTimepoints;
    }

    getSubjectSpecies(id: Number) {
        const subject = this.subjects.find((s) => s.id === id);
        return subject?.species.label;
    }

    timelineTemplate: number | null = null;

    useAsTemplate(subject_id: number) {
        this.timelineTemplate = subject_id;
    }

    async applyTemplate(subject_id: number) {
        if (this.timelineTemplate == null) {
            this.toastService.displayMessage(
                'You must select a subject timeline as a template in order to apply it.',
                ToastType.WARNING,
            );
            return;
        }

        await this.datasourcesApiService
            .applyTimelineTemplate(this.timelineTemplate, subject_id)
            .then((response: any) => {
                if (response.status >= 200 && response.status < 300) {
                    this.toastService.displayMessage(
                        'Timeline from subject ID ' +
                            this.timelineTemplate +
                            ' applied to subject ID ' +
                            subject_id +
                            ' succesfully.',
                        ToastType.SUCCESS,
                    );
                    this.getTimepoints();
                    this.cdr.detectChanges();
                }
            });
    }

    async applyTemplateToStudy(subject_id: number) {
        if (this.timelineTemplate == null) {
            this.toastService.displayMessage(
                'You must select a subject timeline as a template in order to apply it.',
                ToastType.WARNING,
            );
            return;
        }

        const templateSourceId = this.timelineTemplate;

        await this.datasourcesApiService
            .applyTimelineTemplateStudy(templateSourceId)
            .then((response: any) => {
                if (response.status >= 200 && response.status < 300) {
                    this.toastService.displayMessage(
                        'Timeline from subject ID ' +
                            templateSourceId +
                            ' applied to all subjects successfully.',
                        ToastType.SUCCESS,
                    );
                    this.getTimepoints();
                    this.cdr.detectChanges();
                }
            })
            .catch((error: any) => {
                console.error('Error applying template to study:', error);
                this.toastService.displayMessage(
                    'Failed to apply template to study',
                    ToastType.ERROR,
                );
            });
    }

    alleleBulkVisible = false;
    bulkSubjects: any[] = [];
    bulkSubjectAllelesMap = new Map<
        number,
        Array<{ name: string; mhc_class: string }>
    >();

    openAllelePickerBulk() {
        this.bulkSubjects = this.associatedSubjects.map((s) => ({
            id: s.id,
            name: s.subject_id,
        }));

        this.bulkSubjectAllelesMap.clear();

        for (const subject of this.associatedSubjects) {
            const alleles = this.mhc_genotype_list_by_subject[subject.id];

            if (alleles && alleles.length > 0) {
                const formattedAlleles = alleles.map((allele) => ({
                    name: allele.name,
                    mhc_class: allele.mhc_class || 'I',
                }));
                this.bulkSubjectAllelesMap.set(subject.id, formattedAlleles);
            }
        }

        this.alleleBulkVisible = true;
    }

    async refreshAlleleData() {
        await this.getGenotypesBySubject();

        const newMap = new Map();
        for (const subject of this.associatedSubjects) {
            const alleles = this.mhc_genotype_list_by_subject[subject.id];
            if (alleles?.length) {
                newMap.set(
                    subject.id,
                    alleles.map((a) => ({
                        name: a.name,
                        mhc_class: a.mhc_class || 'I',
                    })),
                );
            }
        }
        this.bulkSubjectAllelesMap = newMap;
    }

    handleAddAlleleToSubjects(payload: any) {
        this.datasourcesApiService
            .addGenotypesBulk(
                payload.alleleName,
                payload.alleleClass,
                payload.subjectIds,
            )
            .then((response: any) => {
                this.toastService.displayMessage(
                    `Added ${payload.alleleName} to ${payload.subjectIds.length} subject(s)`,
                    ToastType.SUCCESS,
                );
                this.getGenotypesBySubject();
                this.getSubjects();
                this.refreshAlleleData();
            })
            .catch((error) => {
                console.error('Failed to add alleles:', error);
                this.toastService.displayMessage(
                    `Failed to add ${payload.alleleName} to subjects`,
                    ToastType.ERROR,
                );
            });
    }

    filterSpecies: string[] = [];

    async getSubjectSpeciesFilter() {
        const speciesPromises = this.subjects.map(async (s) => {
            const speciesTerm = await this.getSpeciesTerm(s.species);
            const mhcGroup = this.getMHCGroup(speciesTerm);
            return mhcGroup;
        });

        const speciesResults = await Promise.all(speciesPromises);
        this.filterSpecies = Array.from(
            new Set(
                speciesResults.filter(
                    (species): species is string => species !== null,
                ),
            ),
        );
    }

    async getSpeciesTerm(species: OntologyModel): Promise<SpeciesTerm> {
        if (!species.id || !species.label) {
            return {} as SpeciesTerm;
        }
        try {
            const data: any = await firstValueFrom(
                this.speciesApiService.search(species.label.toLowerCase()),
            );

            if (data.length > 0) {
                return data[0];
            } else {
                console.warn(
                    `No Species term found for species ${species.label}`,
                );
                return { id: '', label: '' } as SpeciesTerm;
            }
        } catch (error: any) {
            console.error(
                `Error fetching Species term for species ${species.label}:`,
                error,
            );
            return { id: '', label: '' } as SpeciesTerm;
        }
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
            // Map H2 to RT1 for mouse
            if (this.directMappings[species.id] === 'H2') {
                return 'RT1';
            }
            return this.directMappings[species.id];
        }

        const parents = species.parents || [];

        if (parents.includes('NCBITaxon:9443')) return 'NHP';
        if (parents.includes('NCBITaxon:9608')) return 'DLA';
        if (parents.includes('NCBITaxon:9935')) return 'CLA';
        if (parents.includes('NCBITaxon:9895')) return 'BoLA';
        if (parents.includes('NCBITaxon:9821')) return 'SLA';
        if (parents.includes('NCBITaxon:8782')) return 'CHICKEN';

        if (parents.includes('NCBITaxon:9989')) {
            // Both rat and mouse return RT1 for Murids
            return 'RT1';
        }

        if (parents.includes('NCBITaxon:8952')) return 'FISH';
        if (parents.includes('NCBITaxon:9788')) return 'ELA';
        if (parents.includes('NCBITaxon:9725')) return 'CeLA';

        return null;
    }

    handleRemoveAlleleFromSubjects(payload: any) {
        this.datasourcesApiService
            .deleteGenotypesBulk(payload.alleleName, payload.subjectIds)
            .then(() => {
                this.toastService.displayMessage(
                    `Removed ${payload.alleleName} from ${payload.subjectIds.length} subject(s)`,
                    ToastType.SUCCESS,
                );
                this.getGenotypesBySubject();
                this.getSubjects();
                this.refreshAlleleData();
            })
            .catch((error) => {
                console.error('Failed to remove alleles:', error);
                this.toastService.displayMessage(
                    `Failed to remove ${payload.alleleName} from subjects`,
                    ToastType.ERROR,
                );
            });
    }

    activeTab: string = 'subjects';

    handleChange($event: any) {
        this.activeTab = $event;

        if (this.activeTab == 'alleles') {
            this.loadAlleleDataForBulkPicker();
        }
    }

    loadAlleleDataForBulkPicker() {
        this.bulkSubjects = this.associatedSubjects.map((s) => ({
            id: s.id,
            name: s.subject_id,
        }));

        this.bulkSubjectAllelesMap.clear();

        for (const subject of this.associatedSubjects) {
            const alleles = this.mhc_genotype_list_by_subject[subject.id];
            if (alleles && alleles.length > 0) {
                const formattedAlleles = alleles.map((allele) => ({
                    name: allele.name,
                    mhc_class: allele.mhc_class || 'I',
                }));
                this.bulkSubjectAllelesMap.set(subject.id, formattedAlleles);
            }
        }
    }

    handleClearAllAlleles(payload: any) {
        const clearPromises = payload.subjectIds.map((subjectId: number) => {
            const alleles = this.mhc_genotype_list_by_subject[subjectId];
            if (alleles && alleles.length > 0) {
                const deletePromises = alleles.map((allele: any) => {
                    return this.datasourcesApiService.deleteGenotypesBulk(
                        allele.name,
                        [subjectId],
                    );
                });
                return Promise.all(deletePromises);
            }
            return Promise.resolve();
        });

        Promise.all(clearPromises)
            .then(() => {
                this.toastService.displayMessage(
                    `Cleared all alleles from ${payload.subjectIds.length} subject(s)`,
                    ToastType.SUCCESS,
                );
                this.getGenotypesBySubject();
                this.getSubjects();
            })
            .catch((error) => {
                console.error('Failed to clear alleles:', error);
                this.toastService.displayMessage(
                    'Failed to clear alleles from subjects',
                    ToastType.ERROR,
                );
            });
    }
}
