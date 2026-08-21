import {
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Output
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CardComponent, DropdownComponent } from '@coreui/angular';
import { DatasetModel } from '../../../../models/shairr/datasources/dataset.model';
import { ReadModel } from '../../../../models/shairr/datasources/read.model';
import { SampleModel } from '../../../../models/shairr/datasources/sample.model';
import { DatasourcesApiService } from '../../../../services/datasources-api.service';
import { ToastService, ToastType } from '../../../../services/toast.service';

@Component({
    selector: 'app-annotate-files',
    templateUrl: './annotate-files.component.html',
    styleUrls: ['./annotate-files.component.scss'],
    providers: [DropdownComponent, CardComponent],
})
export class AnnotateFilesComponent {
    @Output() onCreate = new EventEmitter<any>();
    @Output() onClose = new EventEmitter<void>();

    files: DatasetModel[] = [];
    selectedFile: DatasetModel;
    enums: any = {};
    selectedAligner: any = 'igblast';
    selectedFiles: DatasetModel[] = [];
    url: string = '';
    loading: boolean = false;
    annotationLoading: boolean = false;
    route: ActivatedRoute;
    samples: SampleModel[] = [];
    reads: ReadModel[] = [];
    uploadingFiles = false;

    enumsSelection: any = {
        species: '',
        tissue: '',
        quality_control_template: '',
        sequence_template: '',
        receptor: '',
        sequence_mode: '',
        fastq_files: [],
    };

    constructor(
        public router: Router,
        private activatedRoute: ActivatedRoute,
        private datasourcesApiService: DatasourcesApiService,
        private toastService: ToastService,
        private cdr: ChangeDetectorRef
    ) {
        this.cdr = cdr;
        this.router = router;
        this.route = activatedRoute;
        this.url = window.location.href;
        this.activatedRoute = activatedRoute;
        this.datasourcesApiService = datasourcesApiService;
        this.toastService = toastService;
        this.selectedFile = {} as DatasetModel;

        this.getDatasets();
        this.getSamples();
        this.getReads();

        sessionStorage.setItem('loaded', false.toString());
    }

    async getReads() {
        this.loading = true;
        await this.datasourcesApiService
            .getReads()
            .then((response: any) => {
                return response.json();
            })
            .then((response: ReadModel[]) => {
                this.reads = response;
                this.loading = false;
            });
    }

    async getSamples() {
        this.loading = true;
        await this.datasourcesApiService
            .getSamples()
            .then((response: any) => {
                return response.json();
            })
            .then((response: SampleModel[]) => {
                this.samples = response;
                this.loading = false;
            });
    }

    callIgBlast() {
        //TODO: implement igblast call
    }

    callMiXCR() {
        //TODO: implement mixcr call
    }

    getFileById(id: number): DatasetModel {
        var file = this.files.find((file) => file.id === id);

        if (file) {
            return file;
        }

        throw new Error('File not found');
    }

    selectFile(file: DatasetModel) {
        if (!file.id) {
            console.warn('File has no ID, cannot select:', file);
            return;
        }

        if (!this.selectedFiles.includes(file)) {
            this.selectedFiles.push(file);
        }
    }

    unselectFile(file: DatasetModel) {
        this.selectedFiles = this.selectedFiles.filter((f) => f !== file);
    }

    getDatasets() {
        this.loading = true;
        this.datasourcesApiService
            .getDatasets()
            .then((response: any) => {
                return response.json();
            })
            .then((response: DatasetModel[]) => {
                this.files = response.filter((dataset) =>
                    dataset.filename.includes('fastq')
                );
                this.loading = false;
            });
    }

    uploadFiles() {
        var input = document.getElementById(
            'input-upload-files'
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
                        file.name.endsWith('.gz')
                ),
                    tsvFiles = filesArray.filter((file) =>
                        file.name.endsWith('.tsv')
                    );

                if (fastQFiles.length === 0 && tsvFiles.length === 0) {
                    this.toastService.displayMessage(
                        'No valid FASTQ or TSV files selected. Please select files with .fastq, .fastq.gz, .gz, or .tsv extensions.'
                    );
                    return;
                }

                this.uploadingFiles = true;

                if (fastQFiles.length > 0) {
                    this.datasourcesApiService
                        .uploadFiles(fastQFiles, false)
                        .then(() => {
                            this.toastService.displayMessage(
                                'FASTQ files uploaded successfully.', ToastType.SUCCESS
                            );
                            this.getDatasets();
                        })
                        .catch((error: Error) => {
                            console.error(
                                'Error uploading FASTQ files:',
                                error
                            );
                            this.toastService.displayMessage(
                                'Error uploading FASTQ files. Please try again.'
                                , ToastType.ERROR), ToastType.ERROR;
                        })
                        .finally(() => {
                            this.uploadingFiles = false;
                        });
                }

                if (tsvFiles.length > 0) {
                    this.datasourcesApiService
                        .uploadFiles(tsvFiles, true)
                        .then(() => {
                            this.toastService.displayMessage(
                                'Annotated TSV files uploaded successfully.', ToastType.SUCCESS
                            );
                            this.getDatasets();
                        })
                        .catch((error: Error) => {
                            console.error('Error uploading TSV files:', error);
                            this.toastService.displayMessage(
                                'Error uploading TSV files. Please try again.', ToastType.ERROR
                            );
                        })
                        .finally(() => {
                            this.uploadingFiles = false;
                        });
                }
            }
        };
    }

    humanFileSize(size: number): string {
        const i = Math.floor(Math.log(size) / Math.log(1024));
        return (
            (size / Math.pow(1024, i)).toFixed(2) +
            ' ' +
            ['B', 'kB', 'MB', 'GB', 'TB'][i]
        );
    }

    onFileSelect(event: Event) {
        const selectElement = event.target as HTMLSelectElement;
        const selectedId = selectElement.value;

        this.selectedFile = this.getFileById(parseInt(selectedId));
    }
}
