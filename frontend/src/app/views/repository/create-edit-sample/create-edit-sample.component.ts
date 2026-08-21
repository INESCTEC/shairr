import { Location } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DropdownComponent } from '@coreui/angular';
import { DatasetModel } from 'src/models/shairr/datasources/dataset.model';
import { SampleModel } from 'src/models/shairr/datasources/sample.model';
import { DatasourcesApiService } from 'src/services/datasources-api.service';
import { DefaultModalService } from 'src/services/default-modal.service';
import { ToastService, ToastType } from 'src/services/toast.service';
import { OntologyModel } from '../../../../models/airr/ontology.model';
import { AnnotationModel } from '../../../../models/shairr/datasources/annotation.model';
import { CellTerm } from '../../../../models/shairr/datasources/cell.model';
import { ReadModel } from '../../../../models/shairr/datasources/read.model';
import { StudyModel } from '../../../../models/shairr/datasources/study.model';
import { SubjectModel } from '../../../../models/shairr/datasources/subject.model';
import { TimepointModel } from '../../../../models/shairr/datasources/timepoint.model';
import { UberonTerm } from '../../../../models/shairr/datasources/uberon.model';
import { IdGeneratorService } from '../../../../services/id-generator.service';
import { TimelineEditorComponent } from '../../widgets/timeline-editor/timeline-editor.component';

@Component({
    selector: 'app-create-edit-sample',
    templateUrl: './create-edit-sample.component.html',
    styleUrls: ['./create-edit-sample.component.scss'],
    providers: [DropdownComponent, TimelineEditorComponent],
})
export class CreateEditSampleComponent {
    @Output() onCreate = new EventEmitter<any>();
    @Output() onClose = new EventEmitter<void>();

    subjectForm: any;
    info: any;
    loading: boolean = false;
    selectedTissue: UberonTerm | null = null;
    selectedCellSubset: CellTerm | null = null;
    tissueDisplayText: string = '';
    cellSubsetDisplayText: string = '';
    seeMoreFlag: boolean = false;
    studies: StudyModel[] = [];
    subjects: SubjectModel[] = [];
    sample: SampleModel | null = null;
    files: [DatasetModel, string][] = [];
    selectedFile: [number, string] = [-1, ''];
    fileInput: string = '';
    annotated: AnnotationModel[] = [];
    reads: ReadModel[] = [];
    datasets: DatasetModel[] = [];
    url: string = '';
    route: ActivatedRoute;
    filesLinked: boolean = false;
    timepoints: TimepointModel[] = [];
    displayTimepoints: TimepointModel[] = [];
    editMode: { [key: number]: boolean } = {};
    associatedSamples: SampleModel[] = [];
    samplesLoaded: boolean = false;
    samples: SampleModel[] = [];
    uploadingFiles: boolean = false;
    uploadProgress: number = 0;
    showFilePicker: boolean = false;
    showFilePickerInitialized: boolean = false;
    availableReads: ReadModel[] = [];
    availableAnnotated: AnnotationModel[] = [];
    selectedFilesToAdd: { file: any; type: string }[] = [];

    constructor(
        public router: Router,
        private idGeneratorService: IdGeneratorService,
        private activatedRoute: ActivatedRoute,
        private datasourcesApiService: DatasourcesApiService,
        private toastService: ToastService,
        private modalService: DefaultModalService,
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
    }

    async ngOnInit() {
        if (!this.url.includes('edit')) {
            this.showFilePicker = true;
        }
        await this.initialCall();
    }

    updateProgressBar(progress: number) {
        this.uploadProgress = Math.round(progress);
    }

    uploadFiles() {
        var input = document.getElementById(
            'input-upload-files',
        ) as HTMLInputElement;
        input.click();
        input.onchange = (event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const filesArray = Array.from(target.files);
                const fastQFiles = filesArray.filter(
                    (file) =>
                        file.name.endsWith('.fastq') ||
                        file.name.endsWith('.fastq.gz') ||
                        file.name.endsWith('.gz'),
                );
                const tsvFiles = filesArray.filter((file) =>
                    file.name.endsWith('.tsv'),
                );

                if (fastQFiles.length === 0 && tsvFiles.length === 0) {
                    this.toastService.displayMessage(
                        'No valid files selected.',
                    );
                    return;
                }

                this.uploadingFiles = true;

                window.addEventListener('upload-progress', (e: any) => {
                    const progress = e.detail;
                    this.updateProgressBar(progress.overall_progress);
                });

                window.addEventListener('upload-complete', async (e: any) => {
                    const fileType = e.detail.fileType;
                    this.toastService.displayMessage(
                        `${fileType} files uploaded!`,
                    );
                    this.uploadProgress = 0;

                    // Refresh ALL relevant data sources
                    await this.getReads();
                    await this.getAnnotated();
                    await this.getDatasets();

                    this.uploadingFiles = false;
                    this.cdr.detectChanges();
                });

                window.addEventListener('upload-error', (e: any) => {
                    this.toastService.displayMessage(
                        `Error: ${e.detail.error}`,
                    );
                    this.uploadingFiles = false;
                });

                if (fastQFiles.length > 0) {
                    this.datasourcesApiService
                        .uploadWithProgress(fastQFiles, false, 'FASTQ')
                        .then(async (response: any) => {
                            await this.getDatasets();
                            await this.getReads(); // Get the read records that were just created

                            // Find the read record for the new dataset
                            let sortedDatasets = [...this.datasets].sort(
                                (a, b) => b.id - a.id,
                            );
                            let latest = sortedDatasets[0];

                            // Find the read record that references this dataset
                            let readRecord = this.reads.find(
                                (r) => r.id_dataset === latest.id,
                            );

                            if (readRecord) {
                                this.selectedFile = [readRecord.id, 'read']; // Use READ record ID
                                this.addFileFromUpload();
                            } else {
                                this.toastService.displayMessage(
                                    'Read record not found for uploaded file.',
                                );
                            }
                        });
                }

                // For TSV files
                if (tsvFiles.length > 0) {
                    this.datasourcesApiService
                        .uploadWithProgress(tsvFiles, true, 'TSV')
                        .then(async () => {
                            await this.getDatasets();
                            await this.getAnnotated();

                            // Sort datasets to get the newest
                            let sortedDatasets = [...this.datasets].sort(
                                (a, b) => b.id - a.id,
                            );
                            let latest = sortedDatasets[0];

                            // Find the annotation record that references this dataset
                            let annotationRecord = this.annotated.find(
                                (a) => a.id_dataset === latest.id,
                            );

                            if (annotationRecord) {
                                this.selectedFile = [
                                    annotationRecord.id,
                                    'annotation',
                                ];
                                this.addFileFromUpload();
                            } else {
                                console.error(
                                    'No annotation record found for dataset ID:',
                                    latest.id,
                                );
                                this.toastService.displayMessage(
                                    'Annotation record not found for uploaded file.',
                                );
                            }
                        });
                }
            }
        };
    }

    getFilteredTimepoints(): TimepointModel[] {
        if (!this.timepoints || !this.sample?.id_subject) return [];

        var result = this.timepoints;
        result = result.sort((a, b) => {
            if (
                a.id_relative_time_point == null &&
                b.id_relative_time_point == null
            )
                return 0;
            if (a.id_relative_time_point == null) return 1;
            if (b.id_relative_time_point == null) return -1;
            return a.id_relative_time_point - b.id_relative_time_point;
        });
        return result;
    }

    onSubjectChange() {
        if (!this.sample?.id_subject) return;
        const subject = this.subjects.find(
            (s) => s.id === this.sample?.id_subject,
        );
        if (subject && subject.id_study) {
            this.sample.id_study = subject.id_study;
        }
    }

    async getSamples() {
        this.loading = true;
        this.samples = await this.datasourcesApiService
            .getSamples()
            .then((response: any) => {
                return response.json();
            });
        this.associatedSamples = this.samples.filter(
            (sample) => sample.id_subject == this.sample?.id_subject,
        );
        this.loading = false;
        this.samplesLoaded = true;
    }

    onTissueSelected(term: UberonTerm | null): void {
        if (!this.sample) return;

        if (term) {
            this.selectedTissue = term;
            this.tissueDisplayText = `${term.label} (${term.id})`;
            this.sample.tissue = {
                id: term.id,
                label: term.label,
            };
        } else {
            this.selectedTissue = null;
            this.tissueDisplayText = '';
            this.sample.tissue = null;
        }

        this.cdr.detectChanges();
    }

    onCellSubsetSelected(term: CellTerm | null): void {
        if (!this.sample) return;

        if (term) {
            this.selectedCellSubset = term;
            this.cellSubsetDisplayText = `${term.label} (${term.id})`;
            this.sample.cell_subset = {
                id: term.id,
                label: term.label,
            };
        } else {
            this.selectedCellSubset = null;
            this.cellSubsetDisplayText = '';
            this.sample.cell_subset = null;
        }

        this.cdr.detectChanges();
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

    async getStudies() {
        this.studies = await this.datasourcesApiService
            .getStudies()
            .then((response: any) => {
                return response.json();
            });
    }

    async getSample() {
        if (!this.sample || !this.sample.id) {
            return;
        }

        this.loading = true;
        this.sample = await this.datasourcesApiService
            .getSampleById(this.sample.id)
            .then((response: any) => {
                return response.json();
            });
        this.loading = false;

        // Set initial values for autocomplete components
        if (
            this.sample?.tissue &&
            this.sample.tissue.label &&
            this.sample.tissue.id
        ) {
            this.selectedTissue = {
                id: this.sample.tissue.id,
                label: this.sample.tissue.label,
            } as UberonTerm;
            this.tissueDisplayText = `${this.sample.tissue.label} (${this.sample.tissue.id})`;
        } else {
            this.selectedTissue = null;
            this.tissueDisplayText = '';
        }

        if (
            this.sample?.cell_subset &&
            this.sample.cell_subset.label &&
            this.sample.cell_subset.id
        ) {
            this.selectedCellSubset = {
                id: this.sample.cell_subset.id,
                label: this.sample.cell_subset.label,
            } as CellTerm;
            this.cellSubsetDisplayText = `${this.sample.cell_subset.label} (${this.sample.cell_subset.id})`;
        } else {
            this.selectedCellSubset = null;
            this.cellSubsetDisplayText = '';
        }

        await this.organizeFiles();
    }

    async getSubjects() {
        this.subjects = await this.datasourcesApiService
            .getSubjects()
            .then((response: any) => {
                return response.json();
            });
    }

    async getReads() {
        this.reads = await this.datasourcesApiService
            .getReads()
            .then((response: any) => {
                return response.json();
            });

        if (this.sample?.id) {
            await this.organizeFiles();
        }
        this.updateAvailableFiles();
    }

    async getAnnotated() {
        this.annotated = await this.datasourcesApiService
            .getAnnotated()
            .then((response: any) => {
                return response.json();
            });

        if (this.sample?.id) {
            await this.organizeFiles();
        }
        this.updateAvailableFiles();
    }

    showAlert() {
        if (
            this.sample?.sample_id == '' ||
            this.sample?.sequencing_type == ''
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

        if (!this.sample?.id_study) {
            needed_elements.push('Study ID');
        }

        if (!this.sample?.id_subject) {
            needed_elements.push('Subject ID');
        }

        if (this.sample?.sample_id == '') {
            needed_elements.push('Sample ID');
        }

        if (this.sample?.sequencing_type == '') {
            needed_elements.push('Sequencing Type');
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

    async getDatasets() {
        this.datasets = await this.datasourcesApiService
            .getDatasets()
            .then((response: any) => {
                return response.json();
            });

        if (this.sample?.id) {
            await this.organizeFiles();
        }
        this.updateAvailableFiles();
    }

    async organizeFiles() {
        this.files = [];

        var readIds: number[] = [];
        var annotatedIds: number[] = [];

        if (!this.sample) {
            return;
        }

        for (let read of this.reads) {
            if (read.id_sample === this.sample?.id) {
                readIds.push(read.id_dataset);
            }
        }

        for (let annotation of this.annotated) {
            if (annotation.id_sample === this.sample?.id) {
                annotatedIds.push(annotation.id_dataset);
            }
        }

        this.datasets.forEach((dataset) => {
            if (readIds.includes(dataset.id)) {
                this.files.push([dataset, 'read']);
            } else if (annotatedIds.includes(dataset.id)) {
                this.files.push([dataset, 'annotated']);
            }
        });

        this.files = await this.files.sort(
            (a: [DatasetModel, string], b: [DatasetModel, string]) =>
                a[0].filename.localeCompare(b[0].filename),
        );
    }

    async deleteSample() {
        if (this.sample) {
            const confirmed = await this.modalService.confirm({
                title: 'Delete Sample',
                message:
                    'Are you sure you want to delete this sample? This action cannot be undone.',
                type: 'confirm',
            });

            if (confirmed) {
                this.datasourcesApiService
                    .deleteSample(this.sample.id)
                    .then(() => {
                        this.toastService.displayMessage(
                            'Sample deleted successfully.',
                            ToastType.SUCCESS,
                        );
                        this.router.navigate(['/repository']);
                    })
                    .catch((error: Error) => {
                        console.error('Error deleting sample:', error);
                        this.toastService.displayMessage(
                            'Failed to delete sample. Please try again later.',
                            ToastType.ERROR,
                        );
                    });
            }
        }
    }

    humanFileSize(size: number): string {
        const i = Math.floor(Math.log(size) / Math.log(1024));
        return (
            (size / Math.pow(1024, i)).toFixed(2) +
            ' ' +
            ['B', 'kB', 'MB', 'GB', 'TB'][i]
        );
    }

    async removeFile(file: DatasetModel) {
        var id, type;
        if (file.filename.includes('tsv')) {
            type = 'annotation';
            id = this.annotated.find((a) => a.id_dataset === file.id)
                ?.id as number;
        } else {
            type = 'read';
            id = this.reads.find((r) => r.id_dataset === file.id)?.id as number;
        }
        await this.datasourcesApiService
            .editFile([id, type], {
                id_sample: null,
                id_dataset: file.id,
                id_read: null,
            })
            .then(async () => {
                this.toastService.displayMessage(
                    'File disassociated successfully.',
                    ToastType.SUCCESS,
                );
                this.files = [];
                this.cdr.detectChanges();

                const badges = document.querySelectorAll('i.fa.fa-link.ms-1');
                badges.forEach((badge) => {
                    badge.remove();
                });

                await this.getAnnotated();
                await this.getReads();
                await this.getDatasets();
                await this.organizeFiles();
            })
            .catch((error: Error) => {
                console.error('Error removing file:', error);
                this.toastService.displayMessage(
                    'Failed to remove file. Please try again later.',
                    ToastType.ERROR,
                );
            });
    }

    getReadDataset(rawFile: ReadModel): string {
        if (!this.datasets) {
            return '';
        }

        var file = this.datasets.find((ds) => ds.id === rawFile.id_dataset);
        return file
            ? file.filename +
            ' (' +
            file.line_count +
            ' lines, ' +
            this.humanFileSize(file.filesize) +
            ' | Read ID: ' +
            rawFile.id +
            ')'
            : '';
    }

    getReadDatasetId(rawFile: ReadModel): string {
        if (!this.datasets) {
            return '';
        }
        var file = this.datasets.find((ds) => ds.id === rawFile.id_dataset);
        return file ? file.id.toString() : '';
    }

    async addFileFromUpload() {
        if (this.selectedFile[0] == -1) {
            this.toastService.displayMessage(
                'Please select a valid file to add.',
            );
            return;
        }

        if (!this.sample) {
            this.toastService.displayMessage(
                'Sample data is missing.',
                ToastType.INFO,
            );
            return;
        }

        let fileData: any = {};
        const id = this.selectedFile[0];
        const type = this.selectedFile[1];

        if (type === 'read') {
            const read = this.reads.find((r: ReadModel) => r.id === id);
            if (!read) {
                this.toastService.displayMessage('Read record not found.');
                return;
            }
            fileData = {
                id_sample: this.sample.id,
                id_dataset: read.id_dataset,
                id_read: read.id,
            };
        } else if (type === 'annotation') {
            const annotation = this.annotated.find(
                (a: AnnotationModel) => a.id === id,
            );
            if (!annotation) {
                this.toastService.displayMessage(
                    'Annotation record not found.',
                );
                return;
            }
            fileData = {
                id_sample: this.sample.id,
                id_dataset: annotation.id_dataset,
                id_read: null,
            };
        }

        await this.datasourcesApiService
            .editFile([id, type], fileData)
            .then((response: any) => {
                if (response.ok) {
                    return response.json();
                } else {
                    return response.text().then((text: any) => {
                        throw new Error(text);
                    });
                }
            })
            .then(async (response: any) => {
                await this.getReads();
                await this.getAnnotated();
                await this.getDatasets();
                await this.organizeFiles();
                this.cdr.detectChanges();
                this.toastService.displayMessage(
                    'File added successfully.',
                    ToastType.SUCCESS,
                );
                this.selectedFile = [-1, ''];
            })
            .catch((error: any) => {
                console.error('Error adding file:', error);
                this.toastService.displayMessage(
                    'Failed to add file.',
                    ToastType.ERROR,
                );
            });
    }

    getAnnotatedDataset(annotatedFile: AnnotationModel): string {
        if (!this.datasets) {
            return '';
        }
        var file = this.datasets.find(
            (ds) => ds.id === annotatedFile.id_dataset,
        );
        return file
            ? file.filename +
            ' (' +
            file.line_count +
            ' lines, ' +
            this.humanFileSize(file.filesize) +
            ' | Annotated ID: ' +
            annotatedFile.id +
            ')'
            : '';
    }

    getAnnotatedDatasetId(annotatedFile: AnnotationModel): string {
        if (!this.datasets) {
            return '';
        }
        var file = this.datasets.find(
            (ds) => ds.id === annotatedFile.id_dataset,
        );
        return file ? file.id.toString() : '';
    }

    isReadFileAdded(rawFile: ReadModel): boolean {
        return this.files.some(
            (f: [DatasetModel, string]) =>
                f[0] && f[0].id === rawFile.id_dataset && f[1] === 'read',
        );
    }

    isAnnotatedFileAdded(annotatedFile: AnnotationModel): boolean {
        return this.files.some(
            (f: [DatasetModel, string]) =>
                f[0] &&
                f[0].id === annotatedFile.id_dataset &&
                f[1] === 'annotated',
        );
    }

    generateSampleId() {
        const study: any = this.studies.find(
            (s: any) => s.id === this.sample?.id_study,
        );
        const subject: any = this.subjects.find(
            (s: any) => s.id === this.sample?.id_subject,
        );

        var existingSampleIds = this.samples.map((s) => s.sample_id);

        const newId: string = this.idGeneratorService.generateSampleId(
            this.sample,
            subject?.subject_id || 'SUBJ',
            subject,
            study,
            existingSampleIds,
        );

        if (this.sample) {
            this.sample.sample_id = newId;
        }
    }

    async addFile() {
        if (this.selectedFile[0] == -1) {
            this.toastService.displayMessage(
                'Please select a valid file to add.',
            );
            return;
        }

        if (!this.sample) {
            this.toastService.displayMessage(
                'Sample data is missing.',
                ToastType.INFO,
            );
            return;
        }

        let recordId: number = 0;
        let fileData: any = {};
        const datasetId = this.selectedFile[0];
        const type = this.selectedFile[1];

        if (type === 'read') {
            const read = this.reads.find(
                (r: ReadModel) => r.id_dataset === datasetId,
            );
            if (!read) {
                this.toastService.displayMessage('Read record not found.');
                return;
            }
            recordId = read.id;
            fileData = {
                id_sample: this.sample.id,
                id_dataset: datasetId,
                id_read: recordId,
            };
        } else if (type === 'annotation') {
            const annotation = this.annotated.find(
                (a: AnnotationModel) => a.id_dataset == datasetId,
            );
            if (!annotation) {
                this.toastService.displayMessage(
                    'Annotation record not found.',
                );
                return;
            }
            recordId = annotation.id;
            fileData = {
                id_sample: this.sample.id,
                id_dataset: datasetId,
                id_read: annotation.id_read, // SEND id_read!
            };
        }

        await this.datasourcesApiService
            .editFile([recordId, type], fileData)
            .then((response: any) => {
                if (response.ok) {
                    return response.json();
                } else {
                    return response.text().then((text: any) => {
                        throw new Error(text);
                    });
                }
            })
            .then(async (response: any) => {
                await this.getReads();
                await this.getAnnotated();
                await this.getDatasets();
                await this.organizeFiles();
                this.cdr.detectChanges();
                this.toastService.displayMessage(
                    'File added successfully.',
                    ToastType.SUCCESS,
                );
                this.selectedFile = [-1, ''];
            })
            .catch((error: any) => {
                console.error('Error adding file:', error);
                this.toastService.displayMessage(
                    'Failed to add file.',
                    ToastType.ERROR,
                );
            });
    }

    resetFiles() {
        this.files = [];
    }

    onFileSelect(event: any) {
        const parts = event.target.value
            .split(',')
            .map((part: string) => part.trim());
        this.selectedFile = [Number(parts[0]), parts[1]] as [number, string];
        this.addFile();
    }

    seeFile(file: DatasetModel) {
        this.router.navigate(['/repository/check-dataset/' + file.id]);
    }

    downloadFile(file: DatasetModel) {
        this.datasourcesApiService
            .downloadFile(file.id)
            .then((response: any) => {
                return response.blob();
            })
            .then((blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');

                a.href = url;
                a.download = file.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            })
            .catch((error: Error) => {
                console.error('Error downloading file:', error);
                this.toastService.displayMessage(
                    'Failed to download file. Please try again later.',
                    ToastType.ERROR,
                );
            });
    }

    downloadCSV() {
        if (!this.sample) {
            return;
        }

        this.datasourcesApiService
            .downloadSampleCSV(this.sample.id)
            .then((response: any) => {
                return response.blob();
            })
            .then((blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sample_${this.sample?.sample_id}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            });
    }

    async assignToSample(timepointId: number) {
        if (!this.sample) return;

        this.sample.id_timepoint = timepointId;
        await this.saveSample(false);
    }

    async unassignToSample(timepointId: number) {
        if (!this.sample) return;

        if (this.sample.id_timepoint == timepointId) {
            this.sample.id_timepoint = null;
            await this.saveSample(false);
        }
    }

    onWheel(event: WheelEvent) {
        const container = event.currentTarget as HTMLElement;
        container.scrollLeft += event.deltaY;
        event.preventDefault();
    }

    async getTimepoints() {
        if (!this.sample || this.sample.id_subject === 0) {
            return [];
        }

        this.timepoints = await this.datasourcesApiService
            .getSubjectTimepoints(this.sample.id_subject)
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

    async onIdSubjectChange() {
        await this.getTimepoints();
        this.cdr.detectChanges();
    }

    async initialCall() {
        await this.getStudies();
        await this.getSubjects();
        await this.getSamples();
        await this.getReads();
        await this.getAnnotated();
        await this.getDatasets();

        this.updateAvailableFiles();

        if (this.url.includes('edit')) {
            this.showFilePicker = false;
            this.route.params.subscribe(async (params) => {
                if (this.sample == null && this.url.includes('edit')) {
                    this.sample = {} as SampleModel;
                    this.sample.id = params['sample_id'];
                    this.loading = true;
                    await this.getSample();
                    await this.getTimepoints();
                }
            });
        } else {
            this.showFilePicker = true;
            const hashPart = this.url.split('#')[1];
            const params = hashPart.split(';');

            let studyId = null;
            let subjectId = null;

            for (let param of params) {
                if (param.startsWith('id_study=')) {
                    studyId = parseInt(param.split('=')[1] || '0');
                } else if (param.startsWith('id_subject=')) {
                    subjectId = parseInt(param.split('=')[1] || '0');
                }
            }

            this.sample = {
                id: 0,
                id_study: studyId,
                id_subject: subjectId,
                sample_id: '',
                sample_type: '',
                tissue: {} as OntologyModel,
                cell_subset: {} as OntologyModel,
                cell_phenotype: '',
                sequencing_type: '',
            } as SampleModel;

            if (this.sample.id_subject) {
                const subject = this.subjects.find(
                    (s) => s.id === this.sample?.id_subject,
                );
                if (subject && subject.id_study) {
                    this.sample.id_study = subject.id_study;
                }
            }

            await this.getTimepoints();
        }
    }

    updateAvailableFiles() {
        if (!this.url.includes('edit')) {
            this.availableReads = this.reads.filter(
                (read) => !this.isReadFileAdded(read),
            );
            this.availableAnnotated = this.annotated.filter(
                (ann) => !this.isAnnotatedFileAdded(ann),
            );
            this.showFilePickerInitialized = true;
        }
    }

    triggerFileUpload() {
        const input = document.getElementById(
            'input-upload-files-grid',
        ) as HTMLInputElement;
        if (input) {
            input.click();
        }
    }

    savedSample: boolean = false;

    async onGridFileSelect(event: any) {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            const filesArray = Array.from(target.files);
            const fastQFiles = filesArray.filter(
                (file) =>
                    file.name.endsWith('.fastq') ||
                    file.name.endsWith('.fastq.gz') ||
                    file.name.endsWith('.gz'),
            );
            const tsvFiles = filesArray.filter((file) =>
                file.name.endsWith('.tsv'),
            );

            if (fastQFiles.length === 0 && tsvFiles.length === 0) {
                this.toastService.displayMessage('No valid files selected.');
                target.value = '';
                return;
            }

            this.uploadingFiles = true;

            const progressHandler = (e: any) => {
                this.updateProgressBar(e.detail.overall_progress);
            };

            const completeHandler = (e: any) => {
                this.toastService.displayMessage(
                    `${e.detail.fileType} files uploaded!`,
                );
                this.getReads();
                this.getAnnotated();
                this.getDatasets();
                this.uploadingFiles = false;
                window.removeEventListener('upload-progress', progressHandler);
                window.removeEventListener('upload-complete', completeHandler);
                window.removeEventListener('upload-error', errorHandler);
            };

            const errorHandler = (e: any) => {
                this.toastService.displayMessage(`Error: ${e.detail.error}`);
                this.uploadingFiles = false;
                window.removeEventListener('upload-progress', progressHandler);
                window.removeEventListener('upload-complete', completeHandler);
                window.removeEventListener('upload-error', errorHandler);
            };

            window.addEventListener('upload-progress', progressHandler);
            window.addEventListener('upload-complete', completeHandler);
            window.addEventListener('upload-error', errorHandler);

            if (fastQFiles.length > 0) {
                this.datasourcesApiService
                    .uploadWithProgress(fastQFiles, false, 'FASTQ')
                    .then(async (response: any) => {
                        await this.getDatasets();
                        await this.getReads(); // Get the read records that were just created

                        // Find the read record for the new dataset
                        let sortedDatasets = [...this.datasets].sort(
                            (a, b) => b.id - a.id,
                        );
                        let latest = sortedDatasets[0];

                        // Find the read record that references this dataset
                        let readRecord = this.reads.find(
                            (r) => r.id_dataset === latest.id,
                        );

                        if (readRecord) {
                            this.selectedFile = [readRecord.id, 'read']; // Use READ record ID
                            this.addFileFromUpload();
                        } else {
                            this.toastService.displayMessage(
                                'Read record not found for uploaded file.',
                            );
                        }
                    });
            }

            // For TSV files
            if (tsvFiles.length > 0) {
                this.datasourcesApiService
                    .uploadWithProgress(tsvFiles, true, 'TSV')
                    .then(async () => {
                        await this.getDatasets();
                        await this.getAnnotated(); // Get the annotation records that were just created

                        // Sort datasets to get the newest
                        let sortedDatasets = [...this.datasets].sort(
                            (a, b) => b.id - a.id,
                        );
                        let latest = sortedDatasets[0];

                        // Find the annotation record that references this dataset
                        let annotationRecord = this.annotated.find(
                            (a) => a.id_dataset === latest.id,
                        );

                        if (annotationRecord) {
                            this.selectedFile = [
                                annotationRecord.id,
                                'annotation',
                            ]; // Use ANNOTATION record ID
                            this.addFileFromUpload();
                        } else {
                            this.toastService.displayMessage(
                                'Annotation record not found for uploaded file.',
                            );
                        }
                    });
            }

            target.value = '';
        }
    }

    toggleFileSelection(file: any, type: string) {
        const isSelected = this.selectedFilesToAdd.some(
            (f) => f.file === file && f.type === type,
        );

        if (isSelected) {
            this.selectedFilesToAdd = this.selectedFilesToAdd.filter(
                (f) => !(f.file === file && f.type === type),
            );
        } else {
            this.selectedFilesToAdd.push({ file, type });
        }
    }

    isFileSelected(file: any, type: string): boolean {
        return this.selectedFilesToAdd.some(
            (f) => f.file === file && f.type === type,
        );
    }

    removeFromSelection(selectedFile: { file: any; type: string }) {
        this.selectedFilesToAdd = this.selectedFilesToAdd.filter(
            (f) =>
                !(f.file === selectedFile.file && f.type === selectedFile.type),
        );
    }

    async addSelectedFiles() {
        for (const selectedFile of this.selectedFilesToAdd) {
            let id: number;

            if (selectedFile.type === 'read') {
                id = selectedFile.file.id;
                const fileData = {
                    id_sample: this.sample?.id,
                    id_dataset: selectedFile.file.id_dataset,
                    id_read: null,
                };
                await this.datasourcesApiService
                    .editFile([id, selectedFile.type], fileData)
                    .catch(console.error);
            } else {
                id = selectedFile.file.id;
                const fileData = {
                    id_sample: this.sample?.id,
                    id_dataset: selectedFile.file.id_dataset,
                    id_read: null,
                };
                await this.datasourcesApiService
                    .editFile([id, selectedFile.type], fileData)
                    .catch(console.error);
            }
        }

        await this.getReads();
        await this.getAnnotated();
        await this.getDatasets();
        await this.organizeFiles();
        this.updateAvailableFiles();
        this.selectedFilesToAdd = [];
        this.cdr.detectChanges();
    }

    async saveSample(redirect: boolean, retryCount: number = 0) {
        if (this.savedSample) {
            await this.addSelectedFiles();

            this.toastService.displayMessage(
                'Sample completed successfully.',
                ToastType.SUCCESS,
            );
            this.location.back();
            return;
        }

        try {
            this.loading = true;

            if (!this.sample || this.showAlert()) {
                throw new Error('Sample data is missing.');
            }

            var subjectId = this.sample.id_subject;
            var subject = this.subjects.find((s) => s.id === subjectId);
            if (!subject || !subject.id_study) {
                throw new Error('Subject or associated study data is missing.');
            }

            this.sample.id_study = subject.id_study;

            if (this.sample?.sample_type === '') {
                this.sample.sample_type = null;
            }

            if (this.sample?.cell_phenotype === '') {
                this.sample.cell_phenotype = null;
            }

            if (this.sample?.tissue) {
                if (
                    this.sample.tissue.label === '' ||
                    this.sample.tissue.id === ''
                ) {
                    this.sample.tissue = null;
                }
            } else {
                this.sample.tissue = null;
            }

            if (this.sample?.cell_subset) {
                if (
                    this.sample.cell_subset.label === '' ||
                    this.sample.cell_subset.id === ''
                ) {
                    this.sample.cell_subset = null;
                }
            } else {
                this.sample.cell_subset = null;
            }

            let response;
            if (window.location.href.includes('create')) {
                response = await this.datasourcesApiService.createSample(
                    this.sample,
                );

                if (response.ok) {
                    const responseData = await response.json();
                    this.sample = responseData;
                    this.savedSample = true;
                    this.cdr.detectChanges();
                }
            } else {
                const response = await this.datasourcesApiService.editSample(
                    this.sample,
                );
                if (response !== undefined && response !== null) {
                    await this.getSample();
                    return;
                } else {
                    throw new Error('Failed to update sample');
                }
            }

            if (window.location.href.includes('create')) {
                this.toastService.displayMessage(
                    'Sample saved successfully.',
                    ToastType.SUCCESS,
                );

                if (response.status >= 200 && response.status < 300) {
                    this.onCreate.emit(response);
                    this.cdr.detectChanges();
                } else {

                    this.location.back();
                }
            }
        } catch (error: any) {
            this.onCreate.emit(null);
            this.onClose.emit();

            if (error.error?.detail?.includes('already exists')) {
                const study: any = this.studies.find(
                    (s: any) => s.id === this.sample?.id_study,
                );
                const subject: any = this.subjects.find(
                    (s: any) => s.id === this.sample?.id_subject,
                );

                var existingSampleIds = this.samples.map((s) => s.sample_id);

                const newId: string = this.idGeneratorService.generateSampleId(
                    this.sample,
                    subject?.subject_id || 'SUBJ',
                    subject,
                    study,
                    existingSampleIds,
                );

                const confirmed: boolean = await this.modalService.confirm({
                    title: 'Duplicate Sample ID',
                    message: `Sample ID "${this.sample?.sample_id}" already exists for this subject. Would you like to use "${newId}" instead?`,
                    type: 'confirm',
                });

                if (confirmed && this.sample) {
                    this.sample.sample_id = newId;
                    await this.saveSample(redirect);
                } else {
                    this.loading = false;
                }
            } else {
                console.error('Error creating sample:', error);
                this.toastService.displayMessage(
                    'Failed to save sample, please try again.',
                    ToastType.ERROR,
                );
                this.loading = false;
            }
        } finally {
            this.loading = false;
        }
    }
}
