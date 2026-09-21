import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatasetModel } from 'src/models/shairr/datasources/dataset.model';
import { DefaultModalService } from 'src/services/default-modal.service';
import { ToastService, ToastType } from 'src/services/toast.service';
import { DatasetGroupModel } from '../../../../models/shairr/datasources/dataset_group.model';
import { GenotypeModel } from '../../../../models/shairr/datasources/genotype.model';
import { SampleModel } from '../../../../models/shairr/datasources/sample.model';
import { StudyModel } from '../../../../models/shairr/datasources/study.model';
import { SubjectModel } from '../../../../models/shairr/datasources/subject.model';
import { DatasourcesApiService } from '../../../../services/datasources-api.service';
import { UtilitiesService } from '../../../../services/utilities.service';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
    [x: string]: any;
    studies: StudyModel[] = [];
    samples: SampleModel[] = [];
    subjects: SubjectModel[] = [];
    mhc_genotype_list_by_subject: Record<number, GenotypeModel[]> = {};
    datasets: DatasetModel[] = [];
    private returnedAnnotationDataset: DatasetModel | null = null;
    card: boolean = true;

    constructor(private modalService: DefaultModalService,
        private router: Router,
        private activatedRoute: ActivatedRoute,
        private datasourcesApiService: DatasourcesApiService,
        private toastService: ToastService
    ) {
        this.datasourcesApiService = datasourcesApiService;
        this.loading = false;
        this.card = true;

        const returnedDataset = this.router.getCurrentNavigation()
            ?.extras.state?.['annotationDataset'];

        if (returnedDataset && typeof returnedDataset.id === 'number') {
            this.returnedAnnotationDataset = returnedDataset as DatasetModel;
        }

        this.activeTab = this.activatedRoute.snapshot.queryParamMap.get('tab') === 'datasets'
            ? 'datasets'
            : 'studies';

        this.getStudies();
        this.getSubjects();
        this.getGenotypes();
        this.getSamples();
        this.getDatasets();
        this.getDatasetGroups();
    }

    loading = true;
    showCreateRepository = false;
    newRepositoryTitle = '';
    uploadingFiles = false;

    async togglePublicStatus(study_id: number) {
        await this.datasourcesApiService.togglePublicStudyStatus(study_id).then(async (response: any) => {
            await this.getStudies();
        })

    }

    async toggleStatsSelection(study_id: number) {
        await this.datasourcesApiService.toggleStatsSelection(study_id).then(async (response: any) => {
            await this.getStudies();
        })

    }

    uploadStudies() {
        var input = document.getElementById(
            'input-bulk-json'
        ) as HTMLInputElement;
        input.click();
        input.onchange = (event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                for (let i = 0; i < target.files.length; i++) {
                    const file = target.files[i];

                    const reader = new FileReader();
                    var responses: any[] = [];
                    reader.onload = async (e) => {
                        try {
                            const content = e.target?.result as string;
                            const jsonData = JSON.parse(content);
                            var studiesArray: StudyModel[] = [];

                            for (let item of jsonData['Study']) {
                                studiesArray.push({
                                    id: item.id,
                                    study_id: item.study_id,
                                    study_title: item.study_title,
                                    study_description: item.study_description,
                                    contributors: item.contributors,
                                } as StudyModel);
                            }

                            for (let studyData of studiesArray) {
                                delete (studyData as any)._id;
                                return await this.datasourcesApiService
                                    .createStudy(studyData)
                                    .then(async (response) => {
                                        this.toastService.displayMessage(
                                            `${studiesArray.length} repertoire${studiesArray.length > 1
                                                ? 's'
                                                : ''
                                            } ${studiesArray.length > 1
                                                ? 'are'
                                                : 'is'
                                            } being loaded. This may take a moment.`
                                        );

                                        const reader =
                                            response.body.getReader();
                                        const decoder = new TextDecoder(
                                            'utf-8'
                                        );

                                        let done = false,
                                            final = '';
                                        while (!done) {
                                            const { value, done: readerDone } =
                                                await reader.read();
                                            done = readerDone;
                                            if (value) {
                                                const chunk = decoder.decode(
                                                    value,
                                                    { stream: true }
                                                );
                                                final += chunk;
                                            }
                                        }

                                        if (
                                            final.includes(
                                                'Info: AIRR Study file'
                                            ) &&
                                            final.includes(
                                                'loaded successfully'
                                            ) &&
                                            !final.includes(
                                                'not loaded successfully'
                                            )
                                        ) {
                                            responses.push(response);
                                            this.toastService.displayMessage(
                                                `Study ${studyData.id} uploaded successfully.`
                                            );
                                            this.getStudies();
                                        }
                                    })
                                    .catch((error: Error) => {
                                        console.error(
                                            `Error uploading study ${studyData.id}:`,
                                            error
                                        );
                                        this.toastService.displayMessage(
                                            `Failed to upload study ${studyData.id}. Please try again.`
                                        );
                                    });
                            }
                        } catch (error) {
                            console.error('Error reading file:', error);
                            this.toastService.displayMessage(
                                'Error reading file. Please ensure it is a valid JSON file.'
                                , ToastType.ERROR), ToastType.ERROR;
                        }
                    };
                    reader.readAsText(file);
                }
            }
        };
    }

    async getStudies() {
        this.loading = true;
        await this.datasourcesApiService
            .getStudies()
            .then((response: any) => {
                return response.json();
            })
            .then((response: any) => {
                this.studies = response;
                this.loading = false;
            })
            .catch((error: Error) => {
                console.error('Error fetching studies:', error);
                this.toastService.displayMessage(
                    'Error fetching studies. Please try again later.'
                    , ToastType.ERROR), ToastType.ERROR;
                this.loading = false;
            });
    }

    async getSubjects() {
        this.loading = true;
        await this.datasourcesApiService
            .getSubjects()
            .then((response: any) => {
                return response.json();
            })
            .then((response: any) => {
                this.subjects = response;
                this.loading = false;
            })
            .catch((error: Error) => {
                console.error('Error fetching subjects:', error);
                this.toastService.displayMessage(
                    'Error fetching subjects. Please try again later.'
                    , ToastType.ERROR), ToastType.ERROR;
                this.loading = false;
            });
    }

    async getGenotypes() {
        this.loading = true;
        this.mhc_genotype_list_by_subject = await this.datasourcesApiService
            .getGenotypesBySubject()
            .then((response: any) => {
                return response.json();
            })
            .catch((error: Error) => {
                console.error('Error fetching genotypes:', error);
                this.toastService.displayMessage(
                    'Error fetching genotypes. Please try again later.'
                    , ToastType.ERROR), ToastType.ERROR;
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
            .then((response: any) => {
                this.samples = response;
                this.loading = false;
            })
            .catch((error: Error) => {
                console.error('Error fetching samples:', error);
                this.toastService.displayMessage(
                    'Error fetching samples. Please try again later.'
                    , ToastType.ERROR), ToastType.ERROR;
                this.loading = false;
            });
    }

    async getDatasets() {
        this.loading = true;
        await this.datasourcesApiService
            .getDatasets()
            .then((response: any) => {
                return response.json();
            })
            .then((response: any) => {
                this.datasets = response.filter((d: DatasetModel) => !d.filename.includes('csv'));

                if (
                    this.returnedAnnotationDataset &&
                    !this.datasets.some(dataset =>
                        dataset.id === this.returnedAnnotationDataset?.id
                    )
                ) {
                    this.datasets = [
                        this.returnedAnnotationDataset,
                        ...this.datasets
                    ];
                }

                this.loading = false;
            })
            .catch((error: Error) => {
                console.error('Error fetching datasets:', error);
                this.toastService.displayMessage(
                    'Error fetching datasets. Please try again later.'
                    , ToastType.ERROR), ToastType.ERROR;
                this.loading = false;
            });
    }

    humanFileSize(size: number): string {
        const i = Math.floor(Math.log(size) / Math.log(1024));
        return (
            (size / Math.pow(1024, i)).toFixed(2) +
            ' ' +
            ['B', 'kB', 'MB', 'GB', 'TB'][i]
        );
    }

    getSubjectsCount(id: number): number {
        return this.subjects.filter((subject) => subject.id_study === id)
            .length;
    }

    getSamplesCount(id: number): number {
        const subjectIds = this.subjects
            .filter((subject) => subject.id_study === id)
            .map((subject) => subject.id);
        return this.samples.filter((sample) =>
            subjectIds.includes(sample.id_subject)
        ).length;
    }

    activeTab: string = 'studies';

    handleChange(event: any) {
        this.activeTab = event;
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
                );
                const tsvFiles = filesArray.filter((file) =>
                    file.name.endsWith('.tsv')
                );

                if (fastQFiles.length === 0 && tsvFiles.length === 0) {
                    this.toastService.displayMessage(
                        'No valid files selected.'
                    );
                    return;
                }

                this.uploadingFiles = true;

                window.addEventListener('upload-progress', (e: any) => {
                    const progress = e.detail;
                    this.updateProgressBar(progress.overall_progress);
                });

                window.addEventListener('upload-complete', (e: any) => {
                    const fileType = e.detail.fileType;
                    this.toastService.displayMessage(
                        `${fileType} files uploaded!`
                    );
                    this.getDatasets();
                    this.uploadingFiles = false;
                });

                window.addEventListener('upload-error', (e: any) => {
                    this.toastService.displayMessage(
                        `Error: ${e.detail.error}`
                    );
                    this.uploadingFiles = false;
                });

                if (fastQFiles.length > 0) {
                    this.datasourcesApiService.uploadWithProgress(
                        fastQFiles,
                        false,
                        'FASTQ'
                    );
                }

                if (tsvFiles.length > 0) {
                    this.datasourcesApiService.uploadWithProgress(
                        tsvFiles,
                        true,
                        'TSV'
                    );
                }
            }
        };
    }

    progressBar: number = 0;

    updateProgressBar(progress: number) {
        this.progressBar = progress;
    }

    seeDatasetHead(datasetId: number) {
        this.router.navigate([`/repository/check-dataset/${datasetId}`]);
    }

    goToSendFilesToAnnotation() {
        this.router.navigate(['/repository/annotation']);
    }

    getStudyCellSubset(study: StudyModel) {
        var samples = this.samples.filter((s) => s.id_study == study.id),
            cell_subset = new Set<string>();

        samples.forEach((s) =>
            cell_subset.add(s.cell_subset?.label ? s.cell_subset.label : '')
        );

        cell_subset.delete('');

        return cell_subset.size == 1
            ? samples[0].cell_subset?.label
            : cell_subset.size == 0
                ? 'None'
                : 'Mixed';
    }

    async deleteStudy(study: StudyModel) {
        if (study) {
            if (
                await this.modalService.confirm({ title: 'Confirm', message: 'Are you sure you want to delete this study? This action cannot be undone, and will delete anything that was associated to it.', type: 'confirm' })

            ) {
                this.datasourcesApiService
                    .deleteStudy(study.id)
                    .then(() => {
                        this.toastService.displayMessage(
                            'Study deleted successfully.', ToastType.SUCCESS
                        );
                        this.getStudies();
                    })
                    .catch((error: Error) => {
                        console.error('Error deleting study:', error);
                        this.toastService.displayMessage(
                            'Failed to delete study. Please try again later.'
                            , ToastType.ERROR), ToastType.ERROR;
                    });
            }
        }
    }

    getStudySequencingType(study: StudyModel) {
        var samples = this.samples.filter((s) => s.id_study == study.id),
            sequencing_type = new Set<string>();

        samples.forEach((s) =>
            sequencing_type.add(s.sequencing_type ? s.sequencing_type : '')
        );

        sequencing_type.delete('');

        return sequencing_type.size == 1
            ? samples[0].sequencing_type
                .toLocaleLowerCase()
                .split('_')
                .join(' ')
                .replace(/\b\w/g, (c) => c.toUpperCase())
            : sequencing_type.size == 0
                ? 'None'
                : 'Mixed';
    }

    datasetGroups: DatasetGroupModel[] = [];

    async getDatasetGroups() {
        this.datasetGroups = await this.datasourcesApiService
            .getDatasetGroups()
            .then((response: any) => {
                return response.json();
            });

        while (!this.datasets) { }

        this.datasets = this.datasets.sort(
            (a: DatasetModel, b: DatasetModel) => {
                const nameA = this.getDatasetGroupName(a.id_group) || '';
                const nameB = this.getDatasetGroupName(b.id_group) || '';
                return nameA.localeCompare(nameB);
            }
        );
    }

    getDatasetGroupName(id: Number) {
        return this.datasetGroups.find((d) => d.id == id)?.name;
    }

    getDatasetsWithGroupColors() {
        const datasets = this.getFilteredDatasets();
        const groupMap = new Map<number, string>();
        let colorIndex = 0;

        const uniqueGroups = new Set<number>();
        datasets.forEach((dataset) => {
            uniqueGroups.add(dataset.id_group);
        });

        const groupColorMap = new Map<number, string>();
        Array.from(uniqueGroups).forEach((groupId, index) => {
            const colorClass =
                index % 2 === 0 ? 'group-color-1' : 'group-color-2';
            groupColorMap.set(groupId, colorClass);
        });

        const sortedDatasets = [...datasets].sort((a, b) => {
            const groupA = this.getDatasetGroupName(a.id_group) || '';
            const groupB = this.getDatasetGroupName(b.id_group) || '';
            return groupA.localeCompare(groupB);
        });

        return sortedDatasets.map((dataset) => {
            return {
                ...dataset,
                groupClass:
                    groupColorMap.get(dataset.id_group) || 'group-color-1',
            };
        });
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
                    'Failed to download file. Please try again later.'
                    , ToastType.ERROR), ToastType.ERROR;
            });
    }

    downloadStudiesCSV() {
        this.datasourcesApiService
            .downloadStudiesCSV()
            .then((response: any) => {
                return response.blob();
            })
            .then((blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'studies.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            })
            .catch((error: Error) => {
                console.error('Error downloading studies CSV:', error);
                this.toastService.displayMessage(
                    'Failed to download studies CSV. Please try again later.'
                    , ToastType.ERROR), ToastType.ERROR;
            });
    }

    downloadSubjectsCSV() {
        this.datasourcesApiService
            .downloadSubjectsCSV()
            .then((response: any) => {
                return response.blob();
            })
            .then((blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'subjects.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            })
            .catch((error: Error) => {
                console.error('Error downloading subjects CSV:', error);
                this.toastService.displayMessage(
                    'Failed to download subjects CSV. Please try again later.'
                    , ToastType.ERROR), ToastType.ERROR;
            });
    }

    downloadSamplesCSV() {
        this.datasourcesApiService
            .downloadSamplesCSV()
            .then((response: any) => {
                return response.blob();
            })
            .then((blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'samples.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            })
            .catch((error: Error) => {
                console.error('Error export samples CSV:', error);
                this.toastService.displayMessage(
                    'Failed to export samples CSV. Please try again later.'
                    , ToastType.ERROR), ToastType.ERROR;
            });
    }

    importStudyCSV() {
        var input = document.getElementById(
            'input-import-studies-csv'
        ) as HTMLInputElement;
        input.click();

        input.onchange = (event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                this.datasourcesApiService
                    .importStudyCSV(file)
                    .then((response: any) => {
                        if (response.errors && response.errors.length > 0) {
                            const duplicateErrors = response.errors.filter(
                                (error: string) =>
                                    error.includes('already exists')
                            );
                            const formatErrors = response.errors.filter(
                                (error: string) =>
                                    error.includes('expected') ||
                                    error.includes('fields') ||
                                    error.includes('header')
                            );
                            const otherErrors = response.errors.filter(
                                (error: string) =>
                                    !duplicateErrors.includes(error) &&
                                    !formatErrors.includes(error)
                            );

                            let message = '';

                            if (duplicateErrors.length > 0) {
                                const duplicateIds = duplicateErrors
                                    .map((error: string) => {
                                        const match = error.match(/'([^']+)'/);
                                        return match ? match[1] : null;
                                    })
                                    .filter((id: any) => id !== null);
                                const uniqueDuplicateIds = [
                                    ...new Set(duplicateIds),
                                ];

                                message += `${duplicateErrors.length
                                    } studies were not imported because the following IDs already exist: ${uniqueDuplicateIds.join(
                                        ', '
                                    )}. `;
                            }

                            if (formatErrors.length > 0) {
                                message += `${formatErrors.length} studies have formatting errors. Check CSV header and column count. `;
                            }

                            if (otherErrors.length > 0) {
                                message += `${otherErrors.length} unexpected errors occurred. First error: ${otherErrors[0]}`;
                                console.error(
                                    'Study import errors:',
                                    otherErrors
                                );
                            }

                            this.toastService.displayMessage(message, ToastType.WARNING);
                        } else {
                            this.toastService.displayMessage(
                                'Studies imported successfully.', ToastType.SUCCESS
                            );
                        }
                        this.getStudies();
                    })
                    .catch((error: Error) => {
                        console.error('Error importing study CSV:', error);
                        this.toastService.displayMessage(
                            'Error importing study CSV. Please try again.'
                            , ToastType.ERROR), ToastType.ERROR;
                    });
            }
        };
    }

    importSubjectsCSV() {
        var input = document.getElementById(
            'input-import-subjects-csv'
        ) as HTMLInputElement;
        input.click();
        input.onchange = (event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                this.datasourcesApiService
                    .importSubjectsCSV(file, undefined)
                    .then(() => {
                        this.toastService.displayMessage(
                            'Subjects CSV imported successfully.', ToastType.SUCCESS
                        );
                        this.getSubjects();
                    })
                    .catch((error: Error) => {
                        console.error('Error importing subjects CSV:', error);
                        this.toastService.displayMessage(
                            'Error importing subjects CSV. Please try again.'
                            , ToastType.ERROR), ToastType.ERROR;
                    });
            }
        };
    }

    importSamplesCSV() {
        var input = document.getElementById(
            'input-import-samples-csv'
        ) as HTMLInputElement;
        input.click();
        input.onchange = (event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                this.datasourcesApiService
                    .importSamplesCSV(file, undefined, undefined)
                    .then(() => {
                        this.toastService.displayMessage(
                            'Samples CSV imported successfully.', ToastType.SUCCESS
                        );
                        this.getSamples();
                    })
                    .catch((error: Error) => {
                        console.error('Error importing samples CSV:', error);
                        this.toastService.displayMessage(
                            'Error importing samples CSV. Please try again.'
                            , ToastType.ERROR), ToastType.ERROR;
                    });
            }
        };
    }

    selectedFilter: string = 'Study Title';
    filterInput: string = '';
    studyFilters: [string, string][] = [];
    subjectFilters: [string, string][] = [];
    sampleFilters: [string, string][] = [];
    datasetFilters: [string, string][] = [];

    resetFilters() {
        this.studyFilters = [];
        this.subjectFilters = [];
        this.sampleFilters = [];
        this.datasetFilters = [];
    }

    removeFilter(filter: [string, string]) {
        if (this.isSubjectFilter(filter[0])) {
            this.subjectFilters = this.subjectFilters.filter(
                ([type, value]) => type !== filter[0] && value !== filter[1]
            );
        } else if (this.isSampleFilter(filter[0])) {
            this.sampleFilters = this.sampleFilters.filter(
                ([type, value]) => type !== filter[0] && value !== filter[1]
            );
        } else if (this.isDatasetFilter(filter[0])) {
            this.datasetFilters = this.datasetFilters.filter(
                ([type, value]) => type !== filter[0] && value !== filter[1]
            );
        } else {
            this.studyFilters = this.studyFilters.filter(
                ([type, value]) => type !== filter[0] && value !== filter[1]
            );
        }
    }

    getRoundedLineCount(line_count: number) {
        return UtilitiesService.roundToOneDecimal(line_count);
    }

    addFilter() {
        if (
            !this.selectedFilter ||
            (!this.filterInput &&
                this.selectedFilter !== 'Annotated' &&
                this.selectedFilter !== 'Raw')
        ) {
            this.modalService.alert({ title: 'Alert', message: 'Please select a filter type and enter a filter value.', type: 'alert' });
            return;
        }

        if (
            this.subjectFilters.some(
                ([type, value]) => type === this.selectedFilter
            ) ||
            (this.selectedFilter === 'Annotated' &&
                this.datasetFilters.some(
                    ([type, value]) => type === this.selectedFilter
                )) ||
            (this.selectedFilter === 'Raw' &&
                this.datasetFilters.some(
                    ([type, value]) => type === 'Annotated'
                )) ||
            (this.selectedFilter === 'Annotated' &&
                this.datasetFilters.some(([type, value]) => type === 'Raw'))
        ) {
            this.modalService.alert({ title: 'Alert', message: 'This filter type has already been added.', type: 'alert' });
            return;
        }

        if (this.isSubjectFilter(this.selectedFilter)) {
            this.subjectFilters.push([this.selectedFilter, this.filterInput]);
        } else if (this.isSampleFilter(this.selectedFilter)) {
            this.sampleFilters.push([this.selectedFilter, this.filterInput]);
        } else if (this.isDatasetFilter(this.selectedFilter)) {
            this.datasetFilters.push([this.selectedFilter, this.filterInput]);
        } else {
            this.studyFilters.push([this.selectedFilter, this.filterInput]);
        }

        this.filterInput = '';
    }

    getFilteredStudies(): StudyModel[] {
        let filteredStudies = this.studies;

        for (let [filterType, filterValue] of this.studyFilters) {
            console.log(`Filtering by ${filterType} with value ${filterValue}`);

            filteredStudies = filteredStudies.filter((study) => {
                switch (filterType) {
                    case 'Study ID':
                        return study.study_id
                            .toLowerCase()
                            .includes(filterValue.toLowerCase());
                    case 'Study Title':
                        return study.study_title
                            .toLowerCase()
                            .includes(filterValue.toLowerCase());
                    case 'Study Description':
                        return study.study_description
                            .toLowerCase()
                            .includes(filterValue.toLowerCase());
                    case 'Contributors':
                        return study.contributors
                            .toLowerCase()
                            .includes(filterValue.toLowerCase());
                    default: {
                        return true;
                    }
                }
            });
        }

        return filteredStudies;
    }

    getFilteredSubjects(): SubjectModel[] {
        let filteredSubjects = this.subjects;

        for (let [filterType, filterValue] of this.subjectFilters) {
            console.log(`Filtering by ${filterType} with value ${filterValue}`);

            filteredSubjects = filteredSubjects.filter(
                (subject: SubjectModel) => {
                    switch (filterType) {
                        case 'Subject ID':
                            return subject.subject_id
                                .toLowerCase()
                                .includes(filterValue.toLowerCase());
                        case 'Synthetic': {
                            return subject.synthetic
                                .toString()
                                .toLowerCase()
                                .includes(filterValue.toLowerCase());
                        }
                        case 'Species':
                            if (!subject.species.label || !subject.species.id) {
                                return false;
                            }
                            return (
                                subject.species.label
                                    .toLowerCase()
                                    .includes(filterValue.toLowerCase()) ||
                                subject.species.id
                                    .toString()
                                    .includes(filterValue)
                            );
                        case 'MHC Genotype List':
                            return this.mhc_genotype_list_by_subject[
                                subject.id
                            ].some((g) => g.name == filterValue.toLowerCase());
                        default: {
                            return true;
                        }
                    }
                }
            );
        }

        return filteredSubjects;
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

    isSampleFilter(filterType: string): boolean {
        const sampleFilters = [
            'Sample ID',
            'Sample Type',
            'Tissue',
            'Cell Subset',
            'Cell Phenotype',
            'Sequencing Type',
        ];
        return sampleFilters.includes(filterType);
    }

    isDatasetFilter(filterType: string): boolean {
        const datasetFilters = [
            'Dataset ID',
            'Filename',
            'Filesize',
            'Line Count',
            'Annotated',
            'Raw',
        ];
        return datasetFilters.includes(filterType);
    }

    getFilteredSamples(): SampleModel[] {
        let filteredSamples = this.samples;

        for (let [filterType, filterValue] of this.sampleFilters) {
            console.log(
                `Filtering samples by ${filterType.trimStart()} with value ${filterValue}`
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
                        return sample.sample_type?.toLowerCase()
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
                        return sample.cell_phenotype?.toLowerCase()
                            .includes(filterValue.toLowerCase());
                    case 'Sequencing Type':
                        return sample.sequencing_type
                            .toLowerCase()
                            .includes(filterValue.toLowerCase());
                    default: {
                        return true;
                    }
                }
            });
        }
        return filteredSamples;
    }

    getFilteredDatasets(): DatasetModel[] {
        let filteredDatasets = this.datasets;

        for (let [filterType, filterValue] of this.datasetFilters) {
            console.log(
                `Filtering datasets by ${filterType} with value ${filterValue}`
            );
            filteredDatasets = filteredDatasets.filter((dataset) => {
                switch (filterType) {
                    case 'Dataset ID':
                        return dataset.id.toString().includes(filterValue);
                    case 'Filename':
                        return dataset.filename
                            .toLowerCase()
                            .includes(filterValue.toLowerCase());
                    case 'Filesize':
                        return (
                            parseFloat(
                                this.humanFileSize(dataset.filesize).split(
                                    ' '
                                )[0]
                            ) <= parseFloat(filterValue)
                        );
                    case 'Line Count':
                        return dataset.line_count <= parseInt(filterValue);
                    case 'Annotated':
                        return dataset.annotated;
                    case 'Raw':
                        return !dataset.annotated;
                    default: {
                        return true;
                    }
                }
            });
        }
        return filteredDatasets;
    }

    goToStatistics() {
        this.router.navigate(['/repository/statistics'])
    }
}
