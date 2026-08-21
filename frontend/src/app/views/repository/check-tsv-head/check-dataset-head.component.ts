import {
    AfterViewInit,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    OnDestroy,
    Output
} from '@angular/core';
import { Router } from '@angular/router';

import { Papa } from 'ngx-papaparse';

import { DatasetModel } from 'src/models/shairr/datasources/dataset.model';
import { DatasourcesApiService } from 'src/services/datasources-api.service';
import { ToastService, ToastType } from 'src/services/toast.service';

import { UtilitiesService } from 'src/services/utilities.service';
import { ColumnDefinition, TabulatorFull } from 'tabulator-tables';

@Component({
    selector: 'app-check-dataset-head',
    templateUrl: './check-dataset-head.component.html',
    styleUrls: ['./check-dataset-head.component.scss']
})
export class CheckDatasetHeadComponent implements AfterViewInit, OnDestroy {
    @Output() onCreate = new EventEmitter<any>();
    @Output() onClose = new EventEmitter<void>();

    dataset: DatasetModel | null = null;
    activeTab: 'table' | 'raw' = 'table';

    loading = true;
    showTabulator = false;

    tableData: any[] = [];
    columns: ColumnDefinition[] = [];

    rawTsv = '';

    private tabulator!: TabulatorFull;

    humanFileSize = UtilitiesService.humanFileSize;

    constructor(
        private router: Router,
        private datasourcesApiService: DatasourcesApiService,
        private cdr: ChangeDetectorRef,
        private papa: Papa,
        private toastService: ToastService
    ) {
        const url = window.location.href;
        const urlParts = url.split('/');
        const datasetId = parseInt(urlParts[urlParts.length - 1], 10);

        this.dataset = {} as DatasetModel;
        this.dataset.id = datasetId;

        this.loadData();
    }

    ngAfterViewInit(): void {
    }

    ngOnDestroy(): void {
        if (this.tabulator) {
            this.tabulator.destroy();
        }
    }

    async loadData(): Promise<void> {
        try {
            await Promise.all([
                this.getDataset(),
                this.getDatasetHead()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);

            this.toastService.displayMessage(
                'Failed to load dataset. Please try again.',
                ToastType.ERROR
            );
        } finally {
            this.loading = false;
            this.cdr.detectChanges();
        }
    }

    async getDataset(): Promise<void> {
        if (!this.dataset) {
            return;
        }

        try {
            const response = await this.datasourcesApiService.getDatasetById(this.dataset.id);

            this.dataset = await response.json();
            this.cdr.detectChanges();
        } catch (error) {
            console.error('Error fetching dataset:', error);
            throw error;
        }
    }

    async getDatasetHead(): Promise<void> {
        if (!this.dataset) {
            return;
        }

        try {
            const response = await this.datasourcesApiService.getDatasetPlain(this.dataset.id);

            this.rawTsv = await response.text();

            const result = this.papa.parse(this.rawTsv, {
                delimiter: '\t',
                skipEmptyLines: true,
                fastMode: true
            });

            const rows = result.data as string[][];

            if (rows.length === 0) {
                this.tableData = [];
                this.showTabulator = false;
                return;
            }

            const headers = rows[0];
            const dataObjects: any[] = [];

            for (let rowIndex = 1; rowIndex < Math.min(rows.length, 101); rowIndex++) {
                const row = rows[rowIndex];
                const dataObject: any = {};

                for (let columnIndex = 0; columnIndex < headers.length; columnIndex++) {
                    dataObject[headers[columnIndex]] =
                        columnIndex < row.length
                            ? row[columnIndex] || ''
                            : '';
                }

                dataObjects.push(dataObject);
            }

            this.tableData = dataObjects;

            this.columns = headers.map((header): ColumnDefinition => ({
                title: header,
                field: header,
                minWidth: 100,
                width: this.isSequenceColumn(header) ? 250 : 160,
                resizable: true,
                headerFilter: 'input',
                cssClass: this.isSequenceColumn(header)
                    ? 'sequence-column'
                    : ''
            }));

            this.showTabulator = true;

            this.cdr.detectChanges();

            setTimeout(() => {
                this.initializeTabulator();
            });
        } catch (error) {
            console.error('Error fetching dataset head:', error);

            this.showTabulator = false;

            throw error;
        }
    }

    initializeTabulator(): void {
        const element = document.getElementById('dataset-head');

        if (!element || !this.showTabulator || this.tableData.length === 0) {
            return;
        }

        if (this.tabulator) {
            this.tabulator.destroy();
        }

        this.tabulator = new TabulatorFull('#dataset-head', {
            data: this.tableData,
            columns: this.columns,
            layout: 'fitDataTable',
            movableColumns: true,
            pagination: true,
            paginationSize: 25,
            paginationSizeSelector: [10, 25, 50, 100],
            placeholder: 'No data available',
            height: '100%',
            columnDefaults: {
                resizable: true,
                vertAlign: 'middle',
                headerSort: true
            }
        });
    }

    private isSequenceColumn(columnName: string): boolean {
        const normalizedColumnName = columnName.toLowerCase();

        return (
            normalizedColumnName.includes('sequence') ||
            normalizedColumnName.includes('junction') ||
            normalizedColumnName.includes('germline') ||
            normalizedColumnName.includes('alignment') ||
            normalizedColumnName.includes('id')
        );
    }
}