import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RepertoireModel } from 'src/models/airr/repertoire.model';
import { DatasourcesApiService } from 'src/services/datasources-api.service';
import { ToastService, ToastType } from 'src/services/toast.service';

@Component({
    selector: 'app-statistics-overview',
    templateUrl: './overview.component.html',
    styleUrls: ['./overview.component.scss'],
})
export class OverviewComponent implements OnInit {
    repertoires: RepertoireModel[] = [];
    activeTab: string = 'cdr3';
    loading: boolean = true;
    installingImmunarch: boolean = false;
    installProgress: number = 0;
    installStatus: string = '';

    constructor(
        private route: ActivatedRoute,
        private api: DatasourcesApiService,
        private toast: ToastService,
    ) { }

    async ngOnInit() {
        try {
            this.loading = true;

            // Check if Immunarch is installed
            const isInstalled = await this.api.isImmunarchInstalled();
            console.log('isImmunarchInstalled returned:', isInstalled);

            if (!isInstalled) {
                // Show installation loading screen
                this.installingImmunarch = true;
                this.installStatus = 'Starting Immunarch installation...';
                this.installProgress = 0;

                try {
                    const success = await this.installImmunarchWithProgress();

                    if (success) {
                        this.toast.displayMessage('Immunarch installed successfully!', ToastType.SUCCESS);
                        this.installStatus = 'Installation complete! Loading data...';
                    } else {
                        this.toast.displayMessage('Immunarch installation failed. Some features may be unavailable.', ToastType.ERROR);
                        this.installStatus = 'Installation failed. Continuing with limited functionality...';
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } catch (error) {
                    console.error('Installation error:', error);
                    this.toast.displayMessage('Immunarch installation encountered an error.', ToastType.ERROR);
                    this.installStatus = 'Installation error. Continuing with limited functionality...';
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } finally {
                    this.installingImmunarch = false;
                }
            }

            // Load the data
            await this.loadRepertoireData();

        } catch (error) {
            console.error('Error in ngOnInit:', error);
            this.toast.displayMessage('Failed to load statistics. Please try again.', ToastType.ERROR);
        } finally {
            this.loading = false;
            this.installingImmunarch = false;
        }
    }

    private async installImmunarchWithProgress(): Promise<boolean> {
        return new Promise<boolean>(async (resolve) => {
            try {
                this.installProgress = 10;
                this.installStatus = 'Requesting installation...';

                const response = await this.api.installImmunarch();
                const data = await response.json();

                if (data.id) {
                    // Poll for task completion
                    let completed = false;
                    let attempts = 0;
                    const maxAttempts = 720; // 1 hour max

                    while (!completed && attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 5000));

                        this.installProgress = Math.round(Math.min(10 + (attempts / maxAttempts) * 80, 90));
                        this.installStatus = `Installing Immunarch...`;

                        const statusResponse = await this.api.getTaskStatus(data.id);
                        const status = await statusResponse.json();

                        console.log('Task status:', status); // Debug log

                        // Match the exact TaskStatus enum values from the backend
                        if (status.status === 'FINISHED') {  // Changed from 'COMPLETED' to 'FINISHED'
                            this.installProgress = 100;
                            this.installStatus = 'Installation complete!';
                            completed = true;
                            resolve(true);
                            break;
                        } else if (status.status === 'ERROR' || status.status === 'KILLED') {
                            this.installStatus = `Installation failed: ${status.error_message || 'Unknown error'}`;
                            resolve(false);
                            break;
                        }

                        attempts++;
                    }

                    if (!completed) {
                        this.installStatus = 'Installation timed out but may have succeeded';
                        // Check if image exists anyway
                        const isInstalled = await this.api.isImmunarchInstalled();
                        resolve(isInstalled);
                    }
                } else if (data.message && data.message.includes('already installed')) {
                    this.installProgress = 100;
                    this.installStatus = 'Already installed';
                    resolve(true);
                } else {
                    resolve(false);
                }
            } catch (error) {
                console.error('Installation error:', error);
                resolve(false);
            }
        });
    }

    private async loadRepertoireData() {
        try {
            this.installStatus = 'Loading repertoire data...';

            const [
                repertoiresResponse,
                datasetsResponse,
                sampleDatasetsResponse,
            ] = await Promise.all([
                this.api.getRepertoires(),
                this.api.getDatasets(),
                this.api.getSampleDatasets(),
            ]);

            const allRepertoires = await repertoiresResponse.json();
            const allDatasets = await datasetsResponse.json();
            const sampleDatasetsMap = await sampleDatasetsResponse.json();

            console.log('SampleDatasetMap', sampleDatasetsMap);

            this.repertoires = allRepertoires.Repertoire || allRepertoires;
            const datasets = allDatasets.Dataset || allDatasets;

            // Build dataset map
            const datasetMap = new Map<number, any>();
            for (const ds of datasets) {
                datasetMap.set(ds.id, ds);
            }

            // Attach datasets to samples using sample_id (not database id)
            for (const repertoire of this.repertoires) {
                const samples = repertoire.sample || [];
                console.log(
                    `Repertoire ${repertoire.repertoire_id} has ${samples.length} samples`,
                );

                for (const sample of samples) {
                    const sampleIdKey = sample.sample_id;
                    const datasetIds = sampleDatasetsMap[sampleIdKey] || [];

                    console.log(
                        `Sample ${sampleIdKey}: Dataset IDs:`,
                        datasetIds,
                    );

                    (sample as any).rearrangements = datasetIds
                        .map((id: number) => datasetMap.get(id))
                        .filter(Boolean);

                    console.log(
                        `Sample ${sampleIdKey}: ${(sample as any).rearrangements.length} datasets attached`,
                    );
                }
            }
        } catch (error) {
            console.error('Error loading repertoire data:', error);
            throw error;
        }
    }

    private getCellSubsetLabel(r: RepertoireModel): string | undefined {
        const anyR: any = r;

        // MiAIRR: sample is an array
        if (Array.isArray(anyR.sample) && anyR.sample.length > 0) {
            return anyR.sample[0]?.cell_subset?.label;
        }

        // (fallback if its non-array sample)
        return anyR?.sample?.cell_subset?.label;
    }

    /** Only B-cell repertoires should be used for trees. */
    get bCellRepertoires(): RepertoireModel[] {
        return this.repertoires.filter((r) => this.isBCellRepertoire(r));
    }

    /** Decide if a repertoire is B cell based on sample.cell_subset.label. */
    private isBCellRepertoire(r: RepertoireModel): boolean {
        const label = this.getCellSubsetLabel(r);
        if (!label) return false;

        const raw = label.toLowerCase();
        const compact = raw.replace(/[^a-z0-9]/g, '');

        // Exclude obvious T cells first
        if (
            raw.includes('t cell') ||
            raw.includes('t-cell') ||
            compact.includes('tcell') ||
            compact.includes('tcr') ||
            raw.includes('cd4') ||
            raw.includes('cd8')
        ) {
            return false;
        }

        // B-cell variants
        if (
            raw.includes('b cell') ||
            raw.includes('b-cell') ||
            compact.includes('bcell') ||
            compact.includes('bcr') ||
            raw.includes('memory b') ||
            raw.includes('naive b') ||
            raw.includes('plasmablast') ||
            raw.includes('plasma cell')
        ) {
            return true;
        }

        return false;
    }
}