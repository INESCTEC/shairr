import { Component, Input, OnChanges } from '@angular/core';
import { RepertoireModel } from 'src/models/airr/repertoire.model';
import { DatasetModel } from '../../../../../models/shairr/datasources/dataset.model';
import { DatasourcesApiService } from '../../../../../services/datasources-api.service';
import {
    StatsHelperService,
    StatsStatusUpdate
} from '../../../../../services/stats-helper.service';

type SampleOption = { key: string; label: string };
type RepertoireOption = { key: string; label: string };
type KPI = {
    n: number;
    mean: number;
    median: number;
    q25: number;
    q75: number;
    min: number;
    max: number;
};

type ExpandedRow = {
    repertoireKey: string;
    sampleKey: string;   // repId::sample_id
    sampleLabel: string;
    len: number;
};

type DatasetContext = {
    datasetId: number;
    repertoireKey: string;
    repertoireLabel: string;
    sampleKey: string;
    sampleLabel: string;
    sampleIdRaw: string;
};
@Component({
    selector: 'app-cdr3-length',
    templateUrl: './cdr3-length.component.html',
    styleUrls: ['./cdr3-length.component.scss']
})
export class Cdr3LengthComponent implements OnChanges {
    @Input() repertoires: RepertoireModel[] = [];
    @Input() datasets: DatasetModel[] = [];

    ignoreCache = false;

    private labelMap = new Map<string, string>();

    statusBadge: StatsStatusUpdate | null = null;

    repertoireOptions: RepertoireOption[] = [];
    selectedRepertoireKey = '*';

    sampleOptions: SampleOption[] = [];
    selectedKey = '*';

    kpi: KPI = { n: 0, mean: 0, median: 0, q25: 0, q75: 0, min: 0, max: 0 };

    traces: any[] = [];
    layout: Partial<Plotly.Layout> = {
        title: { text: 'CDR3 length distribution' },
        barmode: 'overlay',
        xaxis: { title: { text: 'CDR3 length (aa)' }, dtick: 1 },
        yaxis: { title: { text: 'Count' } },
        margin: { t: 40, r: 10, b: 60, l: 60 },
        height: 420
    };
    config: Partial<Plotly.Config> = { responsive: true, displayModeBar: true };

    private prevSig = '';
    private allRows: ExpandedRow[] = [];

    constructor(
        private api: DatasourcesApiService,
        private statsHelperService: StatsHelperService
    ) { }

    onCacheToggle() {
        this.statusBadge = null;
        this.traces = [];
        this.kpi = { n: 0, mean: 0, median: 0, q25: 0, q75: 0, min: 0, max: 0 };
        this.allRows = [];
        this.sampleOptions = [];
        this.runCdr3();
    }

    ngOnChanges() {
        const rearrangementIds =
            this.repertoires?.flatMap(r =>
                (r.sample || []).flatMap(s =>
                    (((s as any)?.rearrangements || []) as any[])
                        .map(rr => rr?.id ?? rr?.dataset_id ?? rr?.id_dataset ?? rr?.dataset?.id)
                        .filter((x: any) => x != null)
                )
            ) ?? [];

        const sig = [...rearrangementIds.map(String).sort()].join('|');
        if (sig !== this.prevSig) {
            this.prevSig = sig;

            this.statusBadge = null;
            this.allRows = [];
            this.repertoireOptions = this.buildRepertoireOptions();
            this.sampleOptions = [];
            this.selectedRepertoireKey = '*';
            this.selectedKey = '*';
            this.traces = [];
            this.kpi = { n: 0, mean: 0, median: 0, q25: 0, q75: 0, min: 0, max: 0 };

            this.seedLabelMap();

            this.runCdr3();
        }
    }

    private getRepertoireLabel(r: RepertoireModel): string {
        return (
            r?.subject?.subject_id ||
            r?.repertoire_id ||
            (r as any)?.repertoire_id ||
            `Repertoire #${r?.repertoire_id}`
        );
    }

    private getSampleIdentity(sample: any): string {
        return String(
            sample?.sample_id ??
            sample?.sample_processing_id ??
            sample?.id ??
            ''
        ).trim();
    }

    private getSampleLabel(sample: any, rep?: RepertoireModel): string {
        const raw =
            sample?.sample_processing_id ||
            sample?.sample_id ||
            sample?.id ||
            '';

        const cleaned = String(raw).trim();

        if (!cleaned && rep) {
            return this.getRepertoireLabel(rep);
        }

        if ((this.repertoires?.length || 0) > 1 && rep) {
            return `${this.getRepertoireLabel(rep)} · ${cleaned}`;
        }

        return cleaned || 'Sample';
    }

    private buildRepertoireOptions(): RepertoireOption[] {
        return (this.repertoires || []).map(r => ({
            key: String(r.repertoire_id),
            label: this.getRepertoireLabel(r)
        }));
    }

    private buildSampleOptionsFromRows(rows: ExpandedRow[]): SampleOption[] {
        const seen = new Map<string, string>();

        for (const row of rows) {
            if (!seen.has(row.sampleKey)) {
                seen.set(row.sampleKey, row.sampleLabel);
            }
        }

        return Array.from(seen.entries())
            .map(([key, label]) => ({ key, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    private norm(s: string | undefined | null): string {
        const x = (s ?? '').trim();
        if (!x) return '';
        const base = x.split('/').pop() || x;
        const noExt = base.replace(/\.[^.]+$/, '');
        return noExt.toLowerCase();
    }

    private seedLabelMap() {
        this.labelMap.clear();

        for (const r of this.repertoires || []) {
            const repLabel = this.getRepertoireLabel(r);

            if (r?.id != null) {
                this.labelMap.set(String(r.repertoire_id), repLabel);
                this.labelMap.set(this.norm(String(r.repertoire_id)), repLabel);
            }

            const subj = r?.subject?.subject_id;
            if (subj) {
                this.labelMap.set(String(subj), repLabel);
                this.labelMap.set(this.norm(String(subj)), repLabel);
            }

            for (const s of r.sample || []) {
                const raw = String((s as any)?.sample_id ?? '').trim();
                const proc = String((s as any)?.sample_processing_id ?? '').trim();
                const sid = String((s as any)?.id ?? '').trim();

                const sampleLabel = this.getSampleLabel(s, r);
                const sampleIdentity = this.getSampleIdentity(s);
                const sampleKey = `${r.repertoire_id}::${sampleIdentity}`;

                if (raw) {
                    this.labelMap.set(raw, sampleLabel);
                    this.labelMap.set(this.norm(raw), sampleLabel);
                }

                if (proc) {
                    this.labelMap.set(proc, sampleLabel);
                    this.labelMap.set(this.norm(proc), sampleLabel);
                }

                if (sid) {
                    this.labelMap.set(sid, sampleLabel);
                    this.labelMap.set(this.norm(sid), sampleLabel);
                }

                this.labelMap.set(sampleKey, sampleLabel);
                this.labelMap.set(this.norm(sampleKey), sampleLabel);

                for (const rr of (((s as any)?.rearrangements || []) as any[])) {
                    const rrId = String(
                        rr?.id ?? rr?.dataset_id ?? rr?.id_dataset ?? rr?.dataset?.id ?? ''
                    ).trim();
                    const filename = String(rr?.filename ?? '').trim();

                    if (rrId) {
                        this.labelMap.set(rrId, sampleLabel);
                        this.labelMap.set(this.norm(rrId), sampleLabel);
                    }

                    if (filename) {
                        this.labelMap.set(filename, sampleLabel);
                        this.labelMap.set(this.norm(filename), sampleLabel);
                    }
                }
            }
        }
    }

    private rebuildLabelMap() {
        this.labelMap.clear();

        for (const o of this.sampleOptions) {
            this.labelMap.set(String(o.key), o.label);
            this.labelMap.set(this.norm(o.key), o.label);
        }

        for (const r of this.repertoires || []) {
            const repLabel = this.getRepertoireLabel(r);

            if (r?.id != null) {
                this.labelMap.set(String(r.repertoire_id), repLabel);
                this.labelMap.set(this.norm(String(r.repertoire_id)), repLabel);
            }

            const subj = r?.subject?.subject_id;
            if (subj) {
                this.labelMap.set(String(subj), repLabel);
                this.labelMap.set(this.norm(String(subj)), repLabel);
            }

            for (const s of r.sample || []) {
                const raw = String((s as any)?.sample_id ?? '').trim();
                const proc = String((s as any)?.sample_processing_id ?? '').trim();
                const sid = String((s as any)?.id ?? '').trim();

                const sampleLabel = this.getSampleLabel(s, r);
                const sampleIdentity = this.getSampleIdentity(s);
                const sampleKey = `${r.repertoire_id}::${sampleIdentity}`;

                if (raw) {
                    this.labelMap.set(raw, sampleLabel);
                    this.labelMap.set(this.norm(raw), sampleLabel);
                }

                if (proc) {
                    this.labelMap.set(proc, sampleLabel);
                    this.labelMap.set(this.norm(proc), sampleLabel);
                }

                if (sid) {
                    this.labelMap.set(sid, sampleLabel);
                    this.labelMap.set(this.norm(sid), sampleLabel);
                }

                this.labelMap.set(sampleKey, sampleLabel);
                this.labelMap.set(this.norm(sampleKey), sampleLabel);

                for (const rr of (((s as any)?.rearrangements || []) as any[])) {
                    const rrId = String(
                        rr?.id ?? rr?.dataset_id ?? rr?.id_dataset ?? rr?.dataset?.id ?? ''
                    ).trim();
                    const filename = String(rr?.filename ?? '').trim();

                    if (rrId) {
                        this.labelMap.set(rrId, sampleLabel);
                        this.labelMap.set(this.norm(rrId), sampleLabel);
                    }

                    if (filename) {
                        this.labelMap.set(filename, sampleLabel);
                        this.labelMap.set(this.norm(filename), sampleLabel);
                    }
                }
            }
        }
    }

    private resolveLabel(key: string): string {
        const k = this.norm(key);
        return this.labelMap.get(k) || this.labelMap.get(key) || String(key);
    }

    trackByKey = (_: number, o: SampleOption) => o.key;

    onRepertoireChange(value: string) {
        console.log('[CDR3] onRepertoireChange value:', value, typeof value);

        this.selectedRepertoireKey = value;
        this.selectedKey = '*';
        this.refreshSampleOptions();

        console.log('[CDR3] sampleOptions after repertoire change:', this.sampleOptions);
        console.log('[CDR3] repertoire keys in allRows:', Array.from(new Set(this.allRows.map(r => r.repertoireKey))));

        this.rebuildLabelMap();
        this.updatePlotAndKpi();
    }

    onSampleChange(value: string) {
        this.selectedKey = value;
        this.updatePlotAndKpi();
    }

    private refreshSampleOptions() {
        const rows =
            this.selectedRepertoireKey === '*'
                ? this.allRows
                : this.allRows.filter(r => r.repertoireKey === this.selectedRepertoireKey);

        this.sampleOptions = this.buildSampleOptionsFromRows(rows);

        if (
            this.selectedKey !== '*' &&
            !this.sampleOptions.some(o => o.key === this.selectedKey)
        ) {
            this.selectedKey = '*';
        }
    }

    private computeStats(arr: number[]): KPI {
        const a = arr.slice().sort((x, y) => x - y);
        const n = a.length || 0;
        const mean = n ? a.reduce((s, v) => s + v, 0) / n : 0;
        const med = n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : 0;

        const q = (p: number) => {
            if (!n) return 0;
            const idx = (n - 1) * p;
            const lo = Math.floor(idx), hi = Math.ceil(idx);
            const w = idx - lo;
            return lo === hi ? a[lo] : a[lo] * (1 - w) + a[hi] * w;
        };

        return {
            n,
            mean: +mean.toFixed(2),
            median: +med.toFixed(2),
            q25: +q(0.25).toFixed(2),
            q75: +q(0.75).toFixed(2),
            min: n ? a[0] : 0,
            max: n ? a[n - 1] : 0
        };
    }

    private async getDatasetContexts(): Promise<DatasetContext[]> {
        const out: DatasetContext[] = [];

        console.log('[CDR3] Building dataset contexts...');

        for (const r of this.repertoires || []) {
            const repertoireKey = String(r.repertoire_id);
            const repertoireLabel = this.getRepertoireLabel(r);

            console.log(`[CDR3] Repertoire ${repertoireKey} (${repertoireLabel})`);

            for (const s of r.sample || []) {
                const rawSampleId = String((s as any)?.sample_id ?? '').trim();
                const procSampleId = String((s as any)?.sample_processing_id ?? '').trim();
                const sampleDbId = String((s as any)?.sample_id ?? '').trim();
                const sampleIdentity = this.getSampleIdentity(s);
                const sampleKey = `${repertoireKey}::${sampleIdentity}`;
                const sampleLabel = this.getSampleLabel(s, r);

                const rearrangements = ((s as any)?.rearrangements || []) as any[];

                console.log('[CDR3] Sample:', {
                    repertoireKey,
                    sampleDbId,
                    rawSampleId,
                    procSampleId,
                    sampleKey,
                    sampleLabel,
                    rearrangementCount: rearrangements.length,
                    rearrangementIds: rearrangements.map(
                        rr => rr?.id ?? rr?.dataset_id ?? rr?.id_dataset ?? rr?.dataset?.id
                    )
                });

                if (!rearrangements.length) {
                    console.warn('[CDR3] Sample has no rearrangements:', {
                        repertoireKey,
                        sampleLabel,
                        sample: s
                    });
                }

                for (const rr of rearrangements) {
                    const datasetId =
                        rr?.id ??
                        rr?.dataset_id ??
                        rr?.id_dataset ??
                        rr?.dataset?.id;

                    if (datasetId == null) {
                        console.warn('[CDR3] Rearrangement has no usable dataset id:', {
                            sampleLabel,
                            sampleKey,
                            rearrangement: rr
                        });
                        continue;
                    }

                    out.push({
                        datasetId: Number(datasetId),
                        repertoireKey,
                        repertoireLabel,
                        sampleKey,
                        sampleLabel,
                        sampleIdRaw: rawSampleId || procSampleId || sampleDbId
                    });
                }
            }
        }

        console.log('[CDR3] Final dataset contexts:', out);

        return out;
    }

    private async runCdr3() {
        const contexts = await this.getDatasetContexts();
        const rearrangementIds = Array.from(new Set(contexts.map(c => c.datasetId)));

        console.log('[CDR3] Contexts:', contexts);
        console.log('[CDR3] Rearrangement ids to request:', rearrangementIds);

        if (!rearrangementIds.length) {
            console.warn('[CDR3] No rearrangement ids found. No request will be sent.');
            this.traces = [];
            this.kpi = { n: 0, mean: 0, median: 0, q25: 0, q75: 0, min: 0, max: 0 };
            this.allRows = [];
            this.sampleOptions = [];
            return;
        }

        try {
            const finalDatasets = await this.statsHelperService.requestStatsComputationFromServer(
                rearrangementIds,
                ['distro_cdr3_length', 'cdr3_length_summary_per_sample'],
                this.repertoires,
                partialDatasets => {
                    console.log('[CDR3] Partial datasets returned:', partialDatasets);
                    void this.processCdr3Datasets(partialDatasets, contexts);
                },
                status => {
                    console.log('[CDR3] Status update:', status);
                    this.statusBadge = status;
                },
                this.ignoreCache
            );

            console.log('[CDR3] Final datasets returned:', finalDatasets);
            await this.processCdr3Datasets(finalDatasets, contexts);
        } catch (err) {
            console.error('Error while requesting CDR3 stats:', err);
            this.traces = [];
            this.kpi = { n: 0, mean: 0, median: 0, q25: 0, q75: 0, min: 0, max: 0 };
            this.allRows = [];
            this.sampleOptions = [];
            this.statusBadge = null;
        }
    }

    private async processCdr3Datasets(
        datasets: any[],
        contexts?: DatasetContext[]
    ): Promise<void> {

        if (!datasets?.length) {
            this.traces = [];
            this.kpi = { n: 0, mean: 0, median: 0, q25: 0, q75: 0, min: 0, max: 0 };
            this.allRows = [];
            this.sampleOptions = [];
            return;
        }

        const ctxs = contexts ?? await this.getDatasetContexts();

        const aliasMap = new Map<string, DatasetContext>();
        const ctxByDatasetId = new Map<number, DatasetContext>();

        const addAlias = (key: string | undefined | null, ctx: DatasetContext) => {
            const raw = String(key ?? '').trim();
            if (!raw) return;
            aliasMap.set(raw, ctx);
            aliasMap.set(this.norm(raw), ctx);
            aliasMap.set(raw.toLowerCase(), ctx);
        };

        for (const ctx of ctxs) {
            ctxByDatasetId.set(ctx.datasetId, ctx);

            addAlias(ctx.sampleKey, ctx);
            addAlias(ctx.sampleLabel, ctx);
            addAlias(ctx.repertoireKey, ctx);
            addAlias(ctx.repertoireLabel, ctx);
            addAlias(String(ctx.datasetId), ctx);
            addAlias(ctx.sampleIdRaw, ctx);
        }

        for (const r of this.repertoires || []) {
            const repAliasCtx: DatasetContext = {
                datasetId: -1,
                repertoireKey: String(r.repertoire_id),
                repertoireLabel: this.getRepertoireLabel(r),
                sampleKey: '',
                sampleLabel: '',
                sampleIdRaw: ''
            };

            addAlias(String(r.repertoire_id), repAliasCtx);
            addAlias(String((r as any)?.repertoire_id ?? ''), repAliasCtx);
            addAlias(String(r?.subject?.subject_id ?? ''), repAliasCtx);

            for (const s of r.sample || []) {
                const sampleIdentity = this.getSampleIdentity(s);

                const sampleCtx = ctxs.find((c: any) =>
                    c.repertoireKey === String(r.repertoire_id) &&
                    c.sampleKey === `${String(r.repertoire_id)}::${sampleIdentity}`
                );

                if (!sampleCtx) continue;

                addAlias(String((s as any)?.id ?? ''), sampleCtx);
                addAlias(String((s as any)?.sample_id ?? ''), sampleCtx);
                addAlias(String((s as any)?.sample_processing_id ?? ''), sampleCtx);
                addAlias(String((s as any)?.name ?? ''), sampleCtx);

                for (const rr of (((s as any)?.rearrangements || []) as any[])) {
                    addAlias(
                        String(rr?.id ?? rr?.dataset_id ?? rr?.id_dataset ?? rr?.dataset?.id ?? ''),
                        sampleCtx
                    );
                    addAlias(String(rr?.filename ?? ''), sampleCtx);
                }
            }
        }

        const U = (s: string) =>
            s.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

        const expanded: ExpandedRow[] = [];

        for (const ds of datasets ?? []) {

            const sourceRearrangementId = Number((ds as any)?._sourceRearrangementId ?? '');

            const defaultCtx = Number.isFinite(sourceRearrangementId)
                ? ctxByDatasetId.get(sourceRearrangementId)
                : undefined;

            const body = await this.api.getDatasetRaw(ds.id).catch(err => {
                return '';
            });

            if (body && body.length > 0) {
            } else {
                continue;
            }

            if (!body) {
                continue;
            }

            const lines = body.trim().split(/\r?\n/);

            if (!lines.length) {
                continue;
            }

            const headerLine = lines[0] || '';
            const d = headerLine.includes('\t') ? '\t' : ',';

            const H = headerLine.split(d).map((h: any) => U(h).toLowerCase());

            const hasSample = H.some((h: any) => h.includes('sample') || h.includes('sample_id'));
            const looksLen = H.some((h: any) => /(cdr3.*len(gth)?|^len$|^length$)/i.test(h));

            if (!hasSample || !looksLen) {
                continue;
            }

            const iSample = H.findIndex((h: any) => h.includes('sample'));
            const iLen = H.findIndex((h: any) => /(cdr3.*len(gth)?|^len$|^length$)/i.test(h));
            const iCount = (() => {
                const exact = ['count', 'n', 'frequency', 'freq', 'proportion', 'prop'];
                return H.findIndex((h: any) => exact.includes(h));
            })();

            if (iSample < 0 || iLen < 0 || iCount < 0) {
                continue;
            }

            let rowsProcessed = 0;
            for (let i = 1; i < lines.length; i++) {
                const c = lines[i].split(d).map(U);
                if (!c.length) continue;

                const rawSample = String(c[iSample] ?? '').trim();
                const len = Number(c[iLen] ?? '');
                let count = Number(c[iCount] ?? '1');

                if ((c[iCount] ?? '').toString().endsWith('%')) {
                    count = Number((c[iCount] as string).slice(0, -1)) / 100;
                }

                if (!rawSample || !Number.isFinite(len) || !Number.isFinite(count)) continue;

                const resolvedCtx =
                    aliasMap.get(rawSample) ||
                    aliasMap.get(this.norm(rawSample)) ||
                    aliasMap.get(rawSample.toLowerCase()) ||
                    defaultCtx;

                const repertoireKey = resolvedCtx?.repertoireKey || 'unknown';
                const sampleKey = resolvedCtx?.sampleKey || `unknown::${rawSample}`;
                const sampleLabel = resolvedCtx?.sampleLabel || rawSample || 'Sample';

                const n = Math.floor(count);
                for (let k = 0; k < n; k++) {
                    expanded.push({
                        repertoireKey,
                        sampleKey,
                        sampleLabel,
                        len
                    });
                    rowsProcessed++;
                }
            }
        }


        if (!expanded.length) {
            this.traces = [];
            this.kpi = { n: 0, mean: 0, median: 0, q25: 0, q75: 0, min: 0, max: 0 };
            this.allRows = [];
            this.sampleOptions = [];
            return;
        }

        this.allRows = expanded;
        this.refreshSampleOptions();
        this.rebuildLabelMap();
        this.updatePlotAndKpi();
    }

    private updatePlotAndKpi() {
        if (!this.allRows.length) {
            this.traces = [];
            this.kpi = { n: 0, mean: 0, median: 0, q25: 0, q75: 0, min: 0, max: 0 };
            return;
        }
        console.log('[CDR3] selectedRepertoireKey:', this.selectedRepertoireKey);
        console.log('[CDR3] selectedKey:', this.selectedKey);
        console.log('[CDR3] allRows count:', this.allRows.length);
        console.log('[CDR3] allRows repertoire keys:', Array.from(new Set(this.allRows.map(r => r.repertoireKey))));

        let rows = this.allRows;

        if (this.selectedRepertoireKey !== '*') {
            rows = rows.filter(r => r.repertoireKey === this.selectedRepertoireKey);
        }

        if (this.selectedKey !== '*') {
            rows = rows.filter(r => r.sampleKey === this.selectedKey);
        }

        if (!rows.length) {
            this.traces = [];
            this.kpi = { n: 0, mean: 0, median: 0, q25: 0, q75: 0, min: 0, max: 0 };
            return;
        }

        if (this.selectedKey === '*') {
            const byKey = new Map<string, number[]>();
            this.sampleOptions.forEach(o => byKey.set(o.key, []));
            rows.forEach(r => byKey.get(r.sampleKey)?.push(r.len));

            const keys = this.sampleOptions.map(o => o.key);
            const allX = rows.map(r => r.len).filter(Number.isFinite);
            const xmin = Math.min(...allX);
            const xmax = Math.max(...allX);

            this.traces = keys
                .map(k => {
                    const xNums = (byKey.get(k) || []).map(n => Number(n)).filter(Number.isFinite);
                    if (!xNums.length) return null;

                    return {
                        type: 'histogram',
                        name: this.resolveLabel(k),
                        x: xNums,
                        xbins: { start: xmin - 0.5, end: xmax + 0.5, size: 1 },
                        opacity: 0.55
                    };
                })
                .filter(Boolean);

            this.kpi = this.computeStats(allX);
            this.layout = {
                ...this.layout,
                barmode: 'overlay',
                xaxis: { title: { text: 'CDR3 length (aa)' }, dtick: 1, type: 'linear' },
                yaxis: { title: { text: 'Count' } }
            };
        } else {
            const xs = rows.map(r => Number(r.len)).filter(Number.isFinite);
            const xmin = Math.min(...xs);
            const xmax = Math.max(...xs);

            this.traces = [{
                type: 'histogram',
                name: this.resolveLabel(this.selectedKey),
                x: xs,
                xbins: { start: xmin - 0.5, end: xmax + 0.5, size: 1 }
            }];

            this.kpi = this.computeStats(xs);
            this.layout = {
                ...this.layout,
                barmode: undefined,
                xaxis: { title: { text: 'CDR3 length (aa)' }, dtick: 1, type: 'linear' },
                yaxis: { title: { text: 'Count' } }
            };
        }
    }
}
