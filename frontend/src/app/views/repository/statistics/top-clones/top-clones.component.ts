import { Component, Input, OnChanges } from '@angular/core';
import { DefaultModalService } from 'src/services/default-modal.service';
import { RepertoireModel } from 'src/models/airr/repertoire.model';
import {
    StatsHelperService,
    SampleOption,
    StatsStatusUpdate,
} from '../../../../../services/stats-helper.service';
import { DatasourcesApiService } from 'src/services/datasources-api.service';

type TopCloneRow = {
    sample: string;
    order?: number;
    cdr3: string;
    v?: string;
    j?: string;
    count: number;
    prop?: number; // 0..1
};

type ParsedQuery = {
    raw: string;
    tokens: string[];
    exact?: string;
    regex?: RegExp;
    fields: {
        v: string[];
        j: string[];
        sample: string[];
        cdr3: string[];
    };
};

type DatasetContext = {
    datasetId: number;
    repertoireKey: string;
    repertoireLabel: string;
    sampleKey: string;
    sampleLabel: string;
    sampleIdRaw: string;
    timepointValue: number;
    timepointLabel: string;
    sampleStateLabel: string;
};

@Component({
    selector: 'app-top-clones',
    templateUrl: './top-clones.component.html',
    styleUrls: ['./top-clones.component.scss'],
})
export class TopClonesComponent implements OnChanges {
    @Input() repertoires: RepertoireModel[] = [];
    @Input() trackingOnly = true;

    statusBadge: StatsStatusUpdate | null = null;
    repertoireOptions: SampleOption[] = [];
    selectedRepertoireKey = '';
    topRows: TopCloneRow[] = [];
    sampleOptions: SampleOption[] = [];
    selectedKey = '';
    topN = 10;
    metric: 'prop' | 'count' = 'prop';

    statsKey: 'top_clones' | 'track_clonotypes' = 'top_clones';

    query = '';
    searchMode: 'filter' | 'highlight' = 'highlight';
    pinnedKeys = new Set<string>();

    barTraces: any[] = [];
    barLayout: Partial<Plotly.Layout> = {
        title: { text: 'Top clones' },
        xaxis: { title: { text: 'Proportion' }, tickformat: '.0%' },
        yaxis: { automargin: true },
        margin: { t: 40, r: 20, b: 40, l: 180 },
        height: 520,
    };

    sankeyTraces: any[] = [];
    sankeyLayout: Partial<Plotly.Layout> = {
        title: { text: 'Clonotype tracking' },
        margin: { t: 40, r: 20, b: 40, l: 20 },
        height: 520,
    };

    config: Partial<Plotly.Config> = { responsive: true, displayModeBar: true };

    private labelMap = new Map<string, string>();
    private prevSig = '';

    ignoreCache = false;

    constructor(
        private api: DatasourcesApiService,
        private statsHelperService: StatsHelperService,
    ) {}

    onCacheToggle() {
        this.statusBadge = null;
        this.topRows = [];
        this.barTraces = [];
        this.sankeyTraces = [];

        if (this.trackingOnly) this.statsKey = 'track_clonotypes';
        void this.runTopClones();
    }
    private buildRepertoireOptions(): SampleOption[] {
        return (this.repertoires || []).map((r) => ({
            key: String(r.repertoire_id),
            label: this.getRepertoireLabel(r),
        }));
    }

    private getSampleIdentity(sample: any): string {
        return String(
            sample?.sample_id ??
                sample?.sample_processing_id ??
                sample?.id ??
                '',
        ).trim();
    }

    ngOnChanges(): void {
        if (this.trackingOnly) this.statsKey = 'track_clonotypes';

        const ids =
            this.repertoires?.flatMap((r) =>
                (r.sample || []).flatMap((s) =>
                    (((s as any)?.rearrangements || []) as any[])
                        .map(
                            (rr) =>
                                rr?.id ??
                                rr?.dataset_id ??
                                rr?.id_dataset ??
                                rr?.dataset?.id,
                        )
                        .filter((x: any) => x != null),
                ),
            ) ?? [];

        const sig = [...ids.map(String).sort()].join('|');

        if (sig === this.prevSig) return;
        this.prevSig = sig;

        this.statusBadge = null;
        this.resetTopClonesView();
        this.repertoireOptions = this.buildRepertoireOptions();

        if (
            this.repertoireOptions.length &&
            !this.repertoireOptions.some(
                (o) => o.key === this.selectedRepertoireKey,
            )
        ) {
            this.selectedRepertoireKey = this.repertoireOptions[0].key;
        }

        this.labelMap = this.buildTopClonesLabelMap();

        void this.runTopClones();
    }

    private getDatasetContexts(): DatasetContext[] {
        const out: DatasetContext[] = [];

        for (const rep of this.repertoires || []) {
            const repertoireKey = String(rep.repertoire_id);
            const repertoireLabel = this.getRepertoireLabel(rep);

            for (const sample of rep.sample || []) {
                const sampleIdentity = this.getSampleIdentity(sample);
                const sampleKey = `${repertoireKey}::${sampleIdentity}`;
                const sampleLabel = this.getSampleLabel(sample, rep);

                const sampleIdRaw =
                    String((sample as any)?.sample_id ?? '').trim() ||
                    String(
                        (sample as any)?.sample_processing_id ?? '',
                    ).trim() ||
                    String((sample as any)?.id ?? '').trim();

                const timepointValue = this.getSampleTimepointValue(sample);
                const timepointLabel = this.getSampleTimepointLabel(sample);
                const sampleStateLabel = this.getSampleStateLabel(sample);

                for (const rr of ((sample as any)?.rearrangements ||
                    []) as any[]) {
                    const datasetId =
                        rr?.id ??
                        rr?.dataset_id ??
                        rr?.id_dataset ??
                        rr?.dataset?.id;

                    if (datasetId == null) {
                        continue;
                    }

                    out.push({
                        datasetId: Number(datasetId),
                        repertoireKey,
                        repertoireLabel,
                        sampleKey,
                        sampleLabel,
                        sampleIdRaw,
                        timepointValue,
                        timepointLabel,
                        sampleStateLabel,
                    });
                }
            }
        }

        console.log(`Total contexts created: ${out.length}`);
        if (out.length > 0) {
            console.log('First context:', out[0]);
        }
        return out;
    }

    onSampleChangeValue(value: string) {
        this.selectedKey = value || '';
        this.updatePlot();
    }

    onMetricChangeValue(value: 'prop' | 'count') {
        this.metric = value;

        this.barLayout = {
            ...this.barLayout,
            xaxis:
                this.metric === 'prop'
                    ? { title: { text: 'Proportion' }, tickformat: '.0%' }
                    : { title: { text: 'Count' } },
        };

        this.updatePlot();
    }

    onTopNChange(ev: Event) {
        const v = Number((ev.target as HTMLInputElement).value);
        this.topN = Number.isFinite(v) && v > 0 ? Math.floor(v) : 10;
        this.updatePlot();
    }

    trackByKey = (_: number, o: SampleOption) => o.key;

    private resetTopClonesView() {
        this.topRows = [];
        this.sampleOptions = [];
        this.selectedKey = '';
        this.metric = 'prop';
        this.barTraces = [];
        this.sankeyTraces = [];

        this.barLayout = {
            ...this.barLayout,
            xaxis: { title: { text: 'Proportion' }, tickformat: '.0%' },
        };

        this.sankeyLayout = {
            ...this.sankeyLayout,
            title: { text: 'Clonotype tracking' },
        };
    }

    private getRepertoireLabel(r: RepertoireModel): string {
        return (
            r?.subject?.subject_id ||
            r?.repertoire_name ||
            (r as any)?.name ||
            `Repertoire ${r?.repertoire_id}`
        );
    }

    private getSampleLabel(sample: any, rep?: RepertoireModel): string {
        const raw =
            sample?.sample_processing_id ||
            sample?.sample_id ||
            sample?.id ||
            '';

        const cleaned = String(raw).trim();

        if (!cleaned && rep) return this.getRepertoireLabel(rep);

        if ((this.repertoires?.length || 0) > 1 && rep) {
            return `${this.getRepertoireLabel(rep)} · ${cleaned}`;
        }

        return cleaned || 'Sample';
    }

    private buildSampleOptionsFromParsedRows(
        rows: TopCloneRow[],
    ): SampleOption[] {
        const seen = new Map<string, string>();

        for (const row of rows) {
            if (seen.has(row.sample)) continue;

            const rep = (this.repertoires || []).find((r) =>
                (r.sample || []).some(
                    (s) =>
                        String(s?.sample_id ?? '').trim() ===
                        String(row.sample).trim(),
                ),
            );

            const sampleObj = (rep?.sample || []).find(
                (s) =>
                    String(s?.sample_id ?? '').trim() ===
                    String(row.sample).trim(),
            );

            const label = this.getSampleLabel(sampleObj, rep);
            seen.set(row.sample, label);
        }

        return Array.from(seen.entries())
            .map(([key, label]) => ({ key, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    private buildTopClonesLabelMap(
        options?: SampleOption[],
    ): Map<string, string> {
        const map = new Map<string, string>();

        for (const o of options || []) {
            map.set(String(o.key), o.label);
            map.set(this.statsHelperService.norm(o.key), o.label);
        }

        for (const r of this.repertoires || []) {
            const repLabel = this.getRepertoireLabel(r);

            if (r?.id != null) {
                map.set(String(r.repertoire_id), repLabel);
                map.set(
                    this.statsHelperService.norm(String(r.repertoire_id)),
                    repLabel,
                );
            }

            const subj = r?.subject?.subject_id;
            if (subj) {
                map.set(String(subj), repLabel);
                map.set(this.statsHelperService.norm(String(subj)), repLabel);
            }

            for (const s of r.sample || []) {
                const raw = String((s as any)?.sample_id ?? '').trim();
                const proc = String(
                    (s as any)?.sample_processing_id ?? '',
                ).trim();
                const sid = String((s as any)?.id ?? '').trim();

                const sampleLabel = this.getSampleLabel(s, r);
                const sampleIdentity = this.getSampleIdentity(s);
                const sampleKey = `${r.repertoire_id}::${sampleIdentity}`;

                if (raw) {
                    map.set(raw, sampleLabel);
                    map.set(this.statsHelperService.norm(raw), sampleLabel);
                }

                if (proc) {
                    map.set(proc, sampleLabel);
                    map.set(this.statsHelperService.norm(proc), sampleLabel);
                }

                if (sid) {
                    map.set(sid, sampleLabel);
                    map.set(this.statsHelperService.norm(sid), sampleLabel);
                }

                map.set(sampleKey, sampleLabel);
                map.set(this.statsHelperService.norm(sampleKey), sampleLabel);

                for (const rr of ((s as any)?.rearrangements || []) as any[]) {
                    const rrId = String(
                        rr?.id ??
                            rr?.dataset_id ??
                            rr?.id_dataset ??
                            rr?.dataset?.id ??
                            '',
                    ).trim();
                    const filename = String(rr?.filename ?? '').trim();

                    if (rrId) {
                        map.set(rrId, sampleLabel);
                        map.set(
                            this.statsHelperService.norm(rrId),
                            sampleLabel,
                        );
                    }

                    if (filename) {
                        map.set(filename, sampleLabel);
                        map.set(
                            this.statsHelperService.norm(filename),
                            sampleLabel,
                        );
                    }
                }
            }
        }

        return map;
    }

    private async getStatsDatasetIds(): Promise<number[]> {
        const ids =
            this.repertoires?.flatMap((r) =>
                (r.sample || []).flatMap((s) =>
                    (((s as any)?.rearrangements || []) as any[])
                        .map(
                            (rr) =>
                                rr?.id ??
                                rr?.dataset_id ??
                                rr?.id_dataset ??
                                rr?.dataset?.id,
                        )
                        .filter((x: any) => x != null),
                ),
            ) ?? [];

        return Array.from(new Set(ids.map(Number).filter(Number.isFinite)));
    }

    private async runTopClones() {
        const rearrangementIds = await this.getStatsDatasetIds();

        if (!rearrangementIds.length) {
            this.resetTopClonesView();
            this.statusBadge = null;
            return;
        }

        try {
            console.log('[TopClones] requesting statsKey=', this.statsKey);

            const finalDatasets =
                await this.statsHelperService.requestStatsComputationFromServer(
                    rearrangementIds,
                    [this.statsKey],
                    this.repertoires,
                    (partial: any) => {
                        void this.processTopClonesDatasets(partial);
                    },
                    (status: any) => {
                        this.statusBadge = status;
                    },
                    this.ignoreCache,
                );

            console.log(
                '[TopClones] finalDatasets length=',
                finalDatasets?.length,
                finalDatasets,
            );
            await this.processTopClonesDatasets(finalDatasets);
        } catch (e) {
            console.error('Error while requesting top clones:', e);
            this.statusBadge = null;
            this.resetTopClonesView();
        }
    }

    private updatePlot() {
        console.log('=== updatePlot called ===');
        console.log('topRows length:', this.topRows.length);
        console.log('statsKey:', this.statsKey);
        console.log('selectedKey:', this.selectedKey);
        console.log('sampleOptions:', this.sampleOptions);

        this.barTraces = [];
        this.sankeyTraces = [];

        if (!this.topRows.length) {
            console.log('No topRows, returning');
            return;
        }

        const pq = this.parseQuery(this.query);
        const hasQuery = !!pq.raw;
        const contexts = this.getDatasetContexts();

        if (this.statsKey === 'top_clones') {
            if (!this.selectedKey) {
                console.log('No selectedKey, returning');
                return;
            }

            const rowsForSample0 = this.topRows.filter(
                (r) => r.sample === this.selectedKey,
            );
            console.log(
                `Rows for sample ${this.selectedKey}:`,
                rowsForSample0.length,
            );

            const rowsForSample =
                hasQuery && this.searchMode === 'filter'
                    ? rowsForSample0.filter((r) =>
                          this.matchesParsedQuery(r, pq),
                      )
                    : rowsForSample0;

            if (!rowsForSample.length) {
                console.log(`No rows for sample after filter`);
                this.barLayout = {
                    ...this.barLayout,
                    title: { text: 'Top clones (no matches)' },
                };
                return;
            }

            const hasProp = rowsForSample.some((r) =>
                Number.isFinite(r.prop as number),
            );
            const metricForSample: 'prop' | 'count' =
                this.metric === 'prop' && hasProp ? 'prop' : 'count';

            const value = (r: TopCloneRow) =>
                metricForSample === 'prop' ? (r.prop ?? 0) : (r.count ?? 0);

            const ranked = rowsForSample
                .slice()
                .sort((a, b) => value(b) - value(a));

            const pinnedInSample = ranked.filter((r) =>
                this.pinnedKeys.has(this.clonotypeKey(r)),
            );
            const topBase = ranked.slice(0, this.topN);

            const seen = new Set<string>();
            const merged: TopCloneRow[] = [];
            for (const r of [...pinnedInSample, ...topBase]) {
                const ck = this.clonotypeKey(r);
                if (seen.has(ck)) continue;
                seen.add(ck);
                merged.push(r);
            }

            const top = merged;

            const label = (r: TopCloneRow) => {
                const vj = [r.v, r.j].filter(Boolean).join('|');
                const pin = this.pinnedKeys.has(this.clonotypeKey(r))
                    ? '📌 '
                    : '';
                return vj ? `${pin}${r.cdr3} — ${vj}` : `${pin}${r.cdr3}`;
            };

            if (hasQuery && this.searchMode === 'highlight') {
                const hi: TopCloneRow[] = [];
                const dim: TopCloneRow[] = [];
                for (const r of top) {
                    if (this.matchesParsedQuery(r, pq)) hi.push(r);
                    else dim.push(r);
                }

                const mk = (arr: TopCloneRow[]) => {
                    const y = arr.map(label).reverse();
                    const x = arr.map(value).reverse();
                    const text = arr
                        .map((r) =>
                            metricForSample === 'prop'
                                ? `${(value(r) * 100).toFixed(1)}%`
                                : `${value(r)}`,
                        )
                        .reverse();
                    return { y, x, text };
                };

                const dimT = mk(dim);
                const hiT = mk(hi);

                this.barTraces = [
                    {
                        type: 'bar',
                        orientation: 'h',
                        y: dimT.y,
                        x: dimT.x,
                        text: dimT.text,
                        textposition: 'auto',
                        opacity: 0.25,
                        name: 'Other',
                    },
                    {
                        type: 'bar',
                        orientation: 'h',
                        y: hiT.y,
                        x: hiT.x,
                        text: hiT.text,
                        textposition: 'auto',
                        opacity: 1.0,
                        name: 'Matches',
                    },
                ];
            } else {
                const y = top.map(label).reverse();
                const x = top.map(value).reverse();
                const text = top
                    .map((r) =>
                        metricForSample === 'prop'
                            ? `${(value(r) * 100).toFixed(1)}%`
                            : `${value(r)}`,
                    )
                    .reverse();

                this.barTraces = [
                    {
                        type: 'bar',
                        orientation: 'h',
                        y,
                        x,
                        text,
                        textposition: 'auto',
                    },
                ];
            }

            this.barLayout = {
                ...this.barLayout,
                title: {
                    text: hasQuery
                        ? `Top clones (${this.searchMode}: "${pq.raw}")`
                        : 'Top clones',
                },
                xaxis:
                    metricForSample === 'prop'
                        ? { title: { text: 'Proportion' }, tickformat: '.0%' }
                        : { title: { text: 'Count' } },
            };

            return;
        }

        // For track_clonotypes / tracking view
        const rowsAll = this.selectedRepertoireKey
            ? this.topRows.filter((r) =>
                  r.sample.startsWith(`${this.selectedRepertoireKey}::`),
              )
            : [];

        console.log(`Rows for tracking: ${rowsAll.length}`);

        let filteredRows = rowsAll;

        if (hasQuery && this.searchMode === 'filter') {
            filteredRows = filteredRows.filter((r) =>
                this.matchesParsedQuery(r, pq),
            );
        }

        if (!filteredRows.length) {
            this.sankeyLayout = {
                ...this.sankeyLayout,
                title: { text: 'Clonotype tracking (no matches)' },
            };
            return;
        }

        const hasAnyProp = filteredRows.some((r) =>
            Number.isFinite(r.prop as number),
        );
        const metricForTracking: 'prop' | 'count' =
            this.metric === 'prop' && hasAnyProp ? 'prop' : 'count';

        const highlightKeys =
            hasQuery && this.searchMode === 'highlight'
                ? new Set(
                      filteredRows
                          .filter((r) => this.matchesParsedQuery(r, pq))
                          .map((r) => this.clonotypeKey(r)),
                  )
                : undefined;

        const { traces, samples } = this.buildImmunarchLikeTracking(
            filteredRows,
            metricForTracking,
            highlightKeys,
        );

        const diseaseLabels = this.getDiseaseLabelsForSamples(
            samples,
            contexts,
        );

        this.sankeyTraces = traces;
        this.sankeyLayout = {
            title: {
                text: hasQuery
                    ? `Clonotype tracking (${this.searchMode}: "${pq.raw}")`
                    : 'Clonotype tracking',
            },
            barmode: 'stack',
            bargap: 0.15,
            bargroupgap: 0,
            xaxis: {
                type: 'linear',
                tickmode: 'array',
                tickvals: samples.map((_, i) => i),
                ticktext: diseaseLabels,
                title: { text: 'State / Timepoint' },
            },
            yaxis: {
                title: {
                    text: metricForTracking === 'prop' ? 'Proportion' : 'Count',
                },
                tickformat: metricForTracking === 'prop' ? '.3f' : undefined,
            },
            margin: { t: 60, r: 20, b: 80, l: 70 },
            height: 600,
        };

        console.log(
            'UpdatePlot complete - barTraces:',
            this.barTraces.length,
            'sankeyTraces:',
            this.sankeyTraces.length,
        );
    }

    private async processTopClonesDatasets(datasets: any[]): Promise<void> {
        console.log('=== processTopClonesDatasets called ===');
        console.log('datasets:', datasets);

        if (!datasets?.length) {
            console.log('No datasets, resetting view');
            this.resetTopClonesView();
            return;
        }

        const U = (s: string) => this.statsHelperService.unquote(s);
        const contexts = this.getDatasetContexts();
        console.log('Contexts:', contexts);

        const aliasMap = this.buildTopCloneAliasMap(contexts);
        console.log('Alias map size:', aliasMap.size);

        const ctxByDatasetId = new Map<number, DatasetContext>();
        contexts.forEach((c) => ctxByDatasetId.set(c.datasetId, c));

        const resolvedRows: TopCloneRow[] = [];

        for (const ds of datasets ?? []) {
            console.log(`Processing dataset ${ds.id}`);
            const body = await this.api.getDatasetRaw(ds.id).catch((err) => {
                console.error(`Failed to get dataset ${ds.id}:`, err);
                return '';
            });

            if (!body) {
                console.log(`Empty body for dataset ${ds.id}`);
                continue;
            }

            console.log(`Dataset ${ds.id} body length:`, body.length);
            console.log(`First 200 chars:`, body.substring(0, 200));

            const firstLine = (body as string).split(/\r?\n/)[0] || '';
            if (!firstLine) {
                console.log(`No first line for dataset ${ds.id}`);
                continue;
            }

            const d0 = this.statsHelperService.detectDelimiter(firstLine);
            const H0 = this.statsHelperService
                .splitCsvRow(firstLine, d0)
                .map((h: any) => U(h).toLowerCase());
            console.log(`Headers:`, H0);

            const hasCdr3 = H0.some((h: any) => /(cdr3|clonotype)/.test(h));
            const hasCountOrFreq = H0.some((h: any) =>
                /(count|reads|duplicate_count|umi_count|freq|frequency|proportion|prop)/.test(
                    h,
                ),
            );
            const hasSample = H0.some(
                (h: any) => h.includes('sample') || h.includes('sample_id'),
            );

            console.log(
                `hasSample: ${hasSample}, hasCdr3: ${hasCdr3}, hasCountOrFreq: ${hasCountOrFreq}`,
            );

            if (!(hasSample && hasCdr3 && hasCountOrFreq)) {
                console.log(`Dataset ${ds.id} missing required columns`);
                continue;
            }

            const parsed = this.parseTopClones(body as string);
            console.log(`Parsed ${parsed.length} rows from dataset ${ds.id}`);

            if (!parsed.length) continue;

            const sourceRearrangementId = Number(
                (ds as any)?._sourceRearrangementId ?? '',
            );
            const defaultCtx = Number.isFinite(sourceRearrangementId)
                ? ctxByDatasetId.get(sourceRearrangementId)
                : undefined;

            for (const r of parsed) {
                const rawSample = String(r.sample ?? '').trim();
                console.log(`Processing row - rawSample: "${rawSample}"`);

                // Try multiple ways to find the context
                let ctx = aliasMap.get(rawSample);
                if (!ctx)
                    ctx = aliasMap.get(this.statsHelperService.norm(rawSample));
                if (!ctx) ctx = aliasMap.get(rawSample.toLowerCase());
                if (!ctx && defaultCtx) ctx = defaultCtx;

                if (ctx) {
                    console.log(
                        `Found context for ${rawSample}: ${ctx.sampleKey}`,
                    );
                } else {
                    console.log(
                        `No context found for ${rawSample}, using unknown`,
                    );
                }

                resolvedRows.push({
                    ...r,
                    sample: ctx?.sampleKey || `unknown::${rawSample}`,
                    order: Number.isFinite(r.order as number)
                        ? r.order
                        : Number.isFinite(ctx?.timepointValue)
                          ? ctx!.timepointValue
                          : undefined,
                });
            }
        }

        console.log(`Total resolved rows: ${resolvedRows.length}`);

        if (!resolvedRows.length) {
            console.log('No resolved rows, resetting view');
            this.resetTopClonesView();
            return;
        }

        this.topRows = resolvedRows;
        console.log('First 5 topRows:', this.topRows.slice(0, 5));

        this.sampleOptions = this.buildSampleOptionsFromContexts(
            contexts,
            this.selectedRepertoireKey,
        );

        console.log('Sample options:', this.sampleOptions);

        this.labelMap = this.buildTopClonesLabelMap(this.sampleOptions);

        if (
            !this.selectedKey ||
            !this.sampleOptions.some((o) => o.key === this.selectedKey)
        ) {
            if (this.sampleOptions.length > 0) {
                this.selectedKey = this.sampleOptions[0]?.key || '';
                console.log(`Set selectedKey to: ${this.selectedKey}`);
            } else {
                console.log('No sample options available');
            }
        }

        const selectedHasProp = this.topRows
            .filter((r) => r.sample === this.selectedKey)
            .some((r) => Number.isFinite(r.prop as number));

        this.metric = selectedHasProp ? 'prop' : 'count';

        this.updatePlot();
    }

    onRepertoireChange(value: string) {
        this.selectedRepertoireKey = value || '';

        const contexts = this.getDatasetContexts();
        this.sampleOptions = this.buildSampleOptionsFromContexts(
            contexts,
            this.selectedRepertoireKey,
        );

        this.labelMap = this.buildTopClonesLabelMap(this.sampleOptions);

        this.selectedKey = this.sampleOptions[0]?.key || '';
        this.updatePlot();
    }

    private buildSampleOptionsFromContexts(
        contexts: DatasetContext[],
        repertoireKey: string,
    ): SampleOption[] {
        const filtered = repertoireKey
            ? contexts.filter((c) => c.repertoireKey === repertoireKey)
            : contexts;

        const seen = new Map<string, { label: string; order: number }>();

        for (const ctx of filtered) {
            if (!seen.has(ctx.sampleKey)) {
                seen.set(ctx.sampleKey, {
                    label: ctx.sampleLabel,
                    order: ctx.timepointValue,
                });
            }
        }

        const options = Array.from(seen.entries())
            .sort((a, b) => {
                const ao = a[1].order;
                const bo = b[1].order;
                if (ao !== bo && isFinite(ao) && isFinite(bo)) return ao - bo;
                return a[1].label.localeCompare(b[1].label);
            })
            .map(([key, v]) => ({ key, label: v.label }));

        console.log('Built sample options:', options);
        return options;
    }

    private parseTopClones(txt: string): TopCloneRow[] {
        const lines = txt.trim().split(/\r?\n/);
        if (lines.length < 2) {
            console.log('Less than 2 lines in CSV');
            return [];
        }

        const d = this.statsHelperService.detectDelimiter(lines[0]);
        const U = (s: string) => this.statsHelperService.unquote(s);
        const Hraw = this.statsHelperService
            .splitCsvRow(lines[0], d)
            .map((h: any) => U(h));
        const H = Hraw.map((h: any) => h.toLowerCase());

        console.log('CSV Headers:', H);

        const find = (...names: string[]) => {
            const tgt = names.map((n) => n.toLowerCase());
            return H.findIndex(
                (h: any) => tgt.includes(h) || tgt.some((t) => h.includes(t)),
            );
        };

        const iSample = find('sample', 'sample_id');
        const iOrder = find('order', 'time', 'timepoint', 'visit');
        const iCdr3 = find('cdr3_aa', 'cdr3.aa', 'cdr3aa', 'cdr3', 'clonotype');
        const iV = find('v.name', 'v_gene', 'v_call', 'v');
        const iJ = find('j.name', 'j_gene', 'j_call', 'j');
        const iCount = find(
            'count',
            'reads',
            'duplicate_count',
            'umi_count',
            'clones',
        );
        const iProp = find(
            'proportion',
            'prop',
            'frequency',
            'freq',
            'cloneproportion',
            'value',
        );

        console.log(
            `Column indices - sample:${iSample}, cdr3:${iCdr3}, count:${iCount}, prop:${iProp}, v:${iV}, j:${iJ}`,
        );

        if (iSample < 0 || iCdr3 < 0 || iCount < 0) {
            console.log('Missing required columns');
            return [];
        }

        const toNum = (v: any): number => {
            if (v == null) return NaN;
            const t = String(v).trim().toUpperCase();
            if (!t) return NaN;
            if (t === 'NA' || t === 'NULL' || t === 'N/A') return NaN;
            if (t.endsWith('%')) {
                const n = Number(t.slice(0, -1));
                return Number.isFinite(n) ? n / 100 : NaN;
            }
            const n = Number(t);
            return Number.isFinite(n) ? n : NaN;
        };

        const clean = (v: any): string | undefined => {
            if (v == null) return undefined;
            const s = (v ?? '').toString().trim();
            if (
                !s ||
                s === '' ||
                s.toUpperCase() === 'NA' ||
                s.toUpperCase() === 'NULL'
            ) {
                return undefined;
            }
            return s;
        };

        const out: TopCloneRow[] = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = this.statsHelperService
                .splitCsvRow(lines[i], d)
                .map(U);

            const sample = (cols[iSample] ?? '').toString().trim();
            const cdr3 = (cols[iCdr3] ?? '').toString().trim();
            const count = toNum(cols[iCount]);

            if (!sample || !cdr3 || !Number.isFinite(count)) {
                console.log(
                    `Skipping row ${i}: sample=${sample}, cdr3=${cdr3}, count=${count}`,
                );
                continue;
            }

            const prop = iProp >= 0 ? toNum(cols[iProp]) : NaN;
            const order = iOrder >= 0 ? toNum(cols[iOrder]) : NaN;
            const v = iV >= 0 ? clean(cols[iV]) : undefined;
            const j = iJ >= 0 ? clean(cols[iJ]) : undefined;

            out.push({
                sample,
                cdr3,
                count: Number(count),
                prop: Number.isFinite(prop) ? prop : undefined,
                order: Number.isFinite(order) ? Math.trunc(order) : undefined,
                v,
                j,
            });
        }

        console.log(`Parsed ${out.length} rows total`);
        return out;
    }

    onStatsKeyValueChange(value: 'top_clones' | 'track_clonotypes') {
        if (this.trackingOnly) {
            this.statsKey = 'track_clonotypes';
            return;
        }

        this.statsKey = value;

        this.statusBadge = null;
        this.resetTopClonesView();
        this.repertoireOptions = this.buildRepertoireOptions();
        void this.runTopClones();
    }

    private clonotypeKey(r: TopCloneRow) {
        return [r.cdr3, r.v || '', r.j || ''].join('|');
    }

    private metricValue(metric: 'prop' | 'count', r: TopCloneRow) {
        return metric === 'prop' ? (r.prop ?? 0) : (r.count ?? 0);
    }

    private sortSamplesForTracking(rows: TopCloneRow[]) {
        const samples = Array.from(new Set(rows.map((r) => r.sample)));
        const orderMap = new Map<string, number>();
        for (const r of rows)
            if (Number.isFinite(r.order as number))
                orderMap.set(r.sample, r.order as number);

        return samples.sort(
            (a, b) =>
                (orderMap.get(a) ?? 1e9) - (orderMap.get(b) ?? 1e9) ||
                a.localeCompare(b),
        );
    }

    private selectTopKGlobal(
        rows: TopCloneRow[],
        metric: 'prop' | 'count',
        k: number,
    ) {
        const agg = new Map<string, number>();
        for (const r of rows) {
            const key = this.clonotypeKey(r);
            const v = this.metricValue(metric, r);
            if (!Number.isFinite(v) || v <= 0) continue;
            agg.set(key, (agg.get(key) ?? 0) + v);
        }

        const top = [...agg.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, Math.max(1, k))
            .map(([key]) => key);

        const out = new Set<string>(top);
        for (const p of this.pinnedKeys) out.add(p);

        return out;
    }

    private buildSankey(
        rowsAll: TopCloneRow[],
        metric: 'prop' | 'count',
    ): { trace: any; samples: string[] } {
        const samples = this.sortSamplesForTracking(rowsAll);
        const topKeys = this.selectTopKGlobal(rowsAll, metric, this.topN);

        const valMap = new Map<string, number>();
        for (const r of rowsAll) {
            const ck = this.clonotypeKey(r);
            if (!topKeys.has(ck)) continue;
            const v = this.metricValue(metric, r);
            if (!Number.isFinite(v) || v <= 0) continue;
            valMap.set(`${r.sample}||${ck}`, v);
        }

        const bySample = new Map<string, { ck: string; v: number }[]>();
        for (const s of samples) bySample.set(s, []);
        for (const s of samples) {
            for (const ck of topKeys) {
                const v = valMap.get(`${s}||${ck}`) ?? 0;
                if (v > 0) bySample.get(s)!.push({ ck, v });
            }
            bySample.get(s)!.sort((a, b) => b.v - a.v);
        }

        const nodeIndex = new Map<string, number>();
        const nodeLabel: string[] = [];
        const nodeX: number[] = [];
        const nodeY: number[] = [];

        const sCount = Math.max(1, samples.length);
        const xForSample = (si: number) =>
            sCount === 1 ? 0.5 : si / (sCount - 1);

        const getNode = (sample: string, ck: string): number => {
            const id = `${sample}||${ck}`;
            let idx = nodeIndex.get(id);
            if (idx == null) {
                idx = nodeLabel.length;
                nodeIndex.set(id, idx);

                const [cdr3, v, j] = ck.split('|');
                const vj = [v, j].filter(Boolean).join('|');
                nodeLabel.push(vj ? `${cdr3} — ${vj}` : cdr3);

                nodeX.push(0);
                nodeY.push(0);
            }
            return idx;
        };

        for (let si = 0; si < samples.length; si++) {
            const s = samples[si];
            const items = bySample.get(s) ?? [];
            const total = items.reduce((acc, it) => acc + it.v, 0) || 1;

            let cum = 0;
            for (const it of items) {
                const idx = getNode(s, it.ck);

                nodeX[idx] = xForSample(si);

                const h = it.v / total;
                const y0 = cum / total;
                const yCenter = y0 + h / 2;
                nodeY[idx] = Math.min(0.99, Math.max(0.01, yCenter));

                cum += it.v;
            }
        }

        const source: number[] = [];
        const target: number[] = [];
        const value: number[] = [];

        for (let t = 0; t < samples.length - 1; t++) {
            const s1 = samples[t];
            const s2 = samples[t + 1];

            for (const ck of topKeys) {
                const v2 = valMap.get(`${s2}||${ck}`) ?? 0;
                if (!Number.isFinite(v2) || v2 <= 0) continue;

                source.push(getNode(s1, ck));
                target.push(getNode(s2, ck));
                value.push(v2);
            }
        }

        return {
            trace: {
                type: 'sankey',
                arrangement: 'fixed',
                node: {
                    label: nodeLabel,
                    x: nodeX,
                    y: nodeY,
                    pad: 6,
                    thickness: 14,
                    line: { width: 0 },
                },
                link: { source, target, value },
            },
            samples,
        };
    }

    private buildImmunarchLikeTracking(
        rowsAll: TopCloneRow[],
        metric: 'prop' | 'count',
        highlightKeys?: Set<string>,
    ): { traces: any[]; samples: string[] } {
        const samples = this.sortSamplesForTracking(rowsAll);
        const topKeys = this.selectTopKGlobal(rowsAll, metric, this.topN); // includes pinned

        const BAR_W = 0.8;
        const HALF = BAR_W / 2;

        const OP_RIBBON_HI = 0.3;
        const OP_RIBBON_DIM = 0.1;
        const OP_BAR_HI = 1.0;
        const OP_BAR_DIM = 0.25;

        const STEPS = 14;
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const ease = (t: number) => t * t * (3 - 2 * t);

        const colorFor = (s: string) => {
            let h = 0;
            for (let i = 0; i < s.length; i++)
                h = (h * 31 + s.charCodeAt(i)) >>> 0;
            const hue = h % 360;
            return `hsl(${hue},70%,55%)`;
        };

        const hasHighlight = !!highlightKeys && highlightKeys.size > 0;
        const isHi = (ck: string) => !hasHighlight || highlightKeys!.has(ck);

        const cdr3Of = (ck: string) => ck.split('|')[0];
        const displayName = (ck: string) => {
            const pin = this.pinnedKeys?.has(ck) ? '📌 ' : '';
            return `${pin}${cdr3Of(ck)}`;
        };

        const valMap = new Map<string, number>();
        for (const r of rowsAll) {
            const ck = this.clonotypeKey(r);
            if (!topKeys.has(ck)) continue;
            const v = this.metricValue(metric, r);
            if (!Number.isFinite(v) || v <= 0) continue;
            valMap.set(`${r.sample}||${ck}`, v);
        }

        const sumFor = (ck: string) =>
            samples.reduce(
                (acc, sm) => acc + (valMap.get(`${sm}||${ck}`) ?? 0),
                0,
            );

        const keysBySum = [...topKeys].sort((a, b) => sumFor(b) - sumFor(a));

        const keysDrawOrder = hasHighlight
            ? keysBySum
                  .slice()
                  .sort((a, b) => Number(isHi(a)) - Number(isHi(b)))
            : keysBySum;

        const pos = new Map<
            string,
            Map<string, { y0: number; y1: number; v: number }>
        >();

        for (const sm of samples) {
            let cum = 0;
            const m = new Map<string, { y0: number; y1: number; v: number }>();

            for (const ck of keysBySum) {
                const v = valMap.get(`${sm}||${ck}`) ?? 0;
                if (v <= 0) continue;

                const y0 = cum;
                const y1 = cum + v;
                m.set(ck, { y0, y1, v });
                cum = y1;
            }
            pos.set(sm, m);
        }

        const traces: any[] = [];

        for (const ck of keysDrawOrder) {
            const c = colorFor(ck);
            const hi = isHi(ck);
            const opacity = hi ? OP_RIBBON_HI : OP_RIBBON_DIM;

            for (let i = 0; i < samples.length - 1; i++) {
                const s1 = samples[i];
                const s2 = samples[i + 1];

                const p1 = pos.get(s1)?.get(ck);
                const p2 = pos.get(s2)?.get(ck);

                if (!p1 || !p2) continue;

                const xL = i + HALF;
                const xR = i + 1 - HALF;

                const basePad = metric === 'prop' ? 0.00015 : 0.5;

                const hL = p1.y1 - p1.y0;
                const hR = p2.y1 - p2.y0;

                const padUse = Math.min(basePad, 0.2 * Math.min(hL, hR));

                const y0L = p1.y0 + padUse;
                const y1L = p1.y1 - padUse;
                const y0R = p2.y0 + padUse;
                const y1R = p2.y1 - padUse;

                if (y1L <= y0L || y1R <= y0R) continue;

                const xTop: number[] = [];
                const yTop: number[] = [];
                const xBot: number[] = [];
                const yBot: number[] = [];

                for (let s = 0; s <= STEPS; s++) {
                    const t = ease(s / STEPS);
                    const xx = lerp(xL, xR, t);

                    xTop.push(xx);
                    yTop.push(lerp(y1L, y1R, t));

                    xBot.push(xx);
                    yBot.push(lerp(y0L, y0R, t));
                }

                const xPoly = [...xTop, ...xBot.reverse(), xTop[0]];
                const yPoly = [...yTop, ...yBot.reverse(), yTop[0]];

                traces.push({
                    type: 'scatter',
                    mode: 'lines',
                    x: xPoly,
                    y: yPoly,
                    fill: 'toself',
                    fillcolor: c,
                    line: { width: 0 },
                    opacity,
                    hoverinfo: 'skip',
                    showlegend: false,
                });
            }
        }

        const xCenters = samples.map((_, i) => i);

        for (const ck of keysDrawOrder) {
            const c = colorFor(ck);
            const hi = isHi(ck);

            const y = samples.map((sm) => valMap.get(`${sm}||${ck}`) ?? 0);

            traces.push({
                type: 'bar',
                x: xCenters,
                y,
                width: BAR_W,
                name: displayName(ck),
                marker: { color: c, line: { color: 'black', width: 1 } },
                opacity: hi ? OP_BAR_HI : OP_BAR_DIM,
                hovertemplate: `%{y}<extra>${displayName(ck)}</extra>`,
                showlegend: true,
            });
        }

        return { traces, samples };
    }

    private matchesQuery(r: TopCloneRow, q: string) {
        q = q.trim().toLowerCase();
        if (!q) return true;

        const hay = [r.cdr3 ?? '', r.v ?? '', r.j ?? '', r.sample ?? '']
            .join(' ')
            .toLowerCase();

        return hay.includes(q);
    }

    onQueryChange(v: string) {
        this.query = v;
        this.updatePlot();
    }

    clearQuery() {
        this.query = '';
        this.updatePlot();
    }

    get pinnedList(): string[] {
        return [...this.pinnedKeys.values()].sort();
    }

    isPinnedKey(ck: string) {
        return this.pinnedKeys.has(ck);
    }

    togglePinKey(ck: string) {
        if (!ck) return;
        if (this.pinnedKeys.has(ck)) this.pinnedKeys.delete(ck);
        else this.pinnedKeys.add(ck);
        this.updatePlot();
    }

    clearPins() {
        this.pinnedKeys.clear();
        this.updatePlot();
    }

    pinMatched(rows: TopCloneRow[], maxToPin = 50) {
        const pq = this.parseQuery(this.query);
        if (!pq.raw) return;

        const keys = new Set<string>();
        for (const r of rows) {
            if (this.matchesParsedQuery(r, pq)) keys.add(this.clonotypeKey(r));
            if (keys.size >= maxToPin) break;
        }
        for (const k of keys) this.pinnedKeys.add(k);
        this.updatePlot();
    }

    private parseQuery(q: string): ParsedQuery {
        const raw = (q ?? '').trim();
        const out: ParsedQuery = {
            raw,
            tokens: [],
            fields: { v: [], j: [], sample: [], cdr3: [] },
        };
        if (!raw) return out;

        const rxm = raw.match(/\/(.+)\/([gimsuy]*)$/);
        if (rxm) {
            try {
                out.regex = new RegExp(rxm[1], rxm[2] || 'i');
            } catch {}
            const rest = raw.slice(0, rxm.index).trim();
            if (!rest) return out;
            q = rest;
        } else {
            q = raw;
        }

        const parts = q.split(/\s+/).filter(Boolean);

        for (const p of parts) {
            const t = p.trim();
            if (!t) continue;

            if (t.startsWith('=') && t.length > 1) {
                out.exact = t.slice(1).toLowerCase();
                continue;
            }

            const m = t.match(/^(\w+):(.*)$/);
            if (m) {
                const k = m[1].toLowerCase();
                const v = (m[2] ?? '').trim().toLowerCase();
                if (!v) continue;
                if (k === 'v') out.fields.v.push(v);
                else if (k === 'j') out.fields.j.push(v);
                else if (k === 'sample') out.fields.sample.push(v);
                else if (k === 'cdr3') out.fields.cdr3.push(v);
                else out.tokens.push(t.toLowerCase());
                continue;
            }

            out.tokens.push(t.toLowerCase());
        }

        return out;
    }

    private matchesParsedQuery(r: TopCloneRow, pq: ParsedQuery): boolean {
        if (!pq.raw) return true;

        const cdr3 = (r.cdr3 ?? '').toLowerCase();
        const v = (r.v ?? '').toLowerCase();
        const j = (r.j ?? '').toLowerCase();
        const sample = (r.sample ?? '').toLowerCase();
        const hay = `${cdr3} ${v} ${j}`;

        if (pq.exact && cdr3 !== pq.exact) return false;
        if (pq.regex && !pq.regex.test(r.cdr3 ?? '')) return false;

        for (const vv of pq.fields.v) if (!v.includes(vv)) return false;
        for (const jj of pq.fields.j) if (!j.includes(jj)) return false;
        for (const ss of pq.fields.sample)
            if (!sample.includes(ss)) return false;
        for (const cc of pq.fields.cdr3) if (!cdr3.includes(cc)) return false;

        for (const t of pq.tokens) if (!hay.includes(t)) return false;

        return true;
    }

    private rowMatches(r: TopCloneRow): boolean {
        const pq = this.parseQuery(this.query);
        return this.matchesParsedQuery(r, pq);
    }

    onSearchModeChange(v: 'filter' | 'highlight') {
        this.searchMode = v;
        this.updatePlot();
    }

    private getSampleTimepointValue(sample: any): number {
        const raw = String(sample?.collection_time_point_relative ?? '').trim();
        if (!raw) return Number.POSITIVE_INFINITY;

        const m = raw.match(/[-+]?\d*\.?\d+/);
        if (!m) return Number.POSITIVE_INFINITY;

        const n = Number(m[0]);
        return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
    }

    private getSampleTimepointLabel(sample: any): string {
        return String(sample?.collection_time_point_relative ?? '').trim();
    }

    private buildTopCloneAliasMap(
        contexts: DatasetContext[],
    ): Map<string, DatasetContext> {
        const map = new Map<string, DatasetContext>();

        const add = (key: string | undefined | null, ctx: DatasetContext) => {
            const raw = String(key ?? '').trim();
            if (!raw) return;
            map.set(raw, ctx);
            map.set(this.statsHelperService.norm(raw), ctx);
            map.set(raw.toLowerCase(), ctx);
        };

        // First, add all contexts from the actual dataset contexts
        for (const ctx of contexts) {
            if (!ctx.sampleKey) {
                console.warn('Context missing sampleKey:', ctx);
                // Create a sampleKey if missing
                if (ctx.repertoireKey && ctx.sampleIdRaw) {
                    ctx.sampleKey = `${ctx.repertoireKey}::${ctx.sampleIdRaw}`;
                    console.log(`Created sampleKey: ${ctx.sampleKey}`);
                } else {
                    continue;
                }
            }

            console.log(
                `Adding context - sampleKey: ${ctx.sampleKey}, datasetId: ${ctx.datasetId}`,
            );

            add(String(ctx.datasetId), ctx);
            add(ctx.repertoireKey, ctx);
            add(ctx.sampleKey, ctx);
            add(ctx.repertoireLabel, ctx);
            add(ctx.sampleLabel, ctx);
            add(ctx.sampleIdRaw, ctx);
            add(ctx.sampleStateLabel, ctx);
        }

        // Also add contexts from the repertoire structure directly
        for (const rep of this.repertoires || []) {
            const repertoireKey = String(rep.repertoire_id);
            const repertoireLabel = this.getRepertoireLabel(rep);

            for (const sample of rep.sample || []) {
                const sampleIdentity = this.getSampleIdentity(sample);
                const sampleKey = `${repertoireKey}::${sampleIdentity}`;
                const sampleLabel = this.getSampleLabel(sample, rep);

                console.log(
                    `Building alias for sampleKey: ${sampleKey}, sampleIdentity: ${sampleIdentity}`,
                );

                const ctx: DatasetContext = {
                    datasetId: -1,
                    repertoireKey,
                    repertoireLabel,
                    sampleKey,
                    sampleLabel,
                    sampleIdRaw:
                        String((sample as any)?.sample_id ?? '').trim() ||
                        String(
                            (sample as any)?.sample_processing_id ?? '',
                        ).trim() ||
                        String((sample as any)?.id ?? '').trim(),
                    timepointValue: this.getSampleTimepointValue(sample),
                    timepointLabel: this.getSampleTimepointLabel(sample),
                    sampleStateLabel: this.getSampleStateLabel(sample),
                };

                // Add all possible keys that might match the CSV sample
                add(String(rep.repertoire_id), ctx);
                add(String((rep as any)?.id ?? ''), ctx);
                add(String(rep?.subject?.subject_id ?? ''), ctx);

                // CRITICAL: Add the sample identity (hash) - this is what appears in the CSV
                add(sampleIdentity, ctx);
                add(sampleKey, ctx);

                // Add sample ID variations
                add(String((sample as any)?.id ?? ''), ctx);
                add(String((sample as any)?.sample_id ?? ''), ctx);
                add(String((sample as any)?.sample_processing_id ?? ''), ctx);
                add(String((sample as any)?.name ?? ''), ctx);

                // Add rearrangement IDs
                for (const rr of ((sample as any)?.rearrangements ||
                    []) as any[]) {
                    const rrId = String(
                        rr?.id ??
                            rr?.dataset_id ??
                            rr?.id_dataset ??
                            rr?.dataset?.id ??
                            '',
                    );
                    if (rrId) {
                        add(rrId, ctx);
                    }
                    add(String(rr?.filename ?? ''), ctx);
                }
            }
        }

        console.log('Alias map size:', map.size);
        // Log all keys that match the pattern
        const matchingKeys = Array.from(map.keys()).filter(
            (key) =>
                key.includes('5f07aa9039579433171763ce') ||
                key.includes('SAMPLE'),
        );
        console.log('Matching keys in alias map:', matchingKeys);

        return map;
    }

    private getSampleStateLabel(sample: any): string {
        const raw =
            (sample as any)?.collection_time_point_reference ??
            (sample as any)?.disease_state_sample ??
            (sample as any)?.disease_diagnosis?.study_group_description ??
            '';

        const label = String(raw ?? '').trim();
        return label || 'Unknown';
    }
    private getDiseaseLabelsForSamples(
        samples: string[],
        contexts: DatasetContext[],
    ): string[] {
        const bySampleKey = new Map<string, DatasetContext>();

        for (const ctx of contexts) {
            if (!bySampleKey.has(ctx.sampleKey)) {
                bySampleKey.set(ctx.sampleKey, ctx);
            }
        }

        return samples.map((sampleKey) => {
            const ctx = bySampleKey.get(sampleKey);
            if (!ctx) return 'Unknown';

            const state = ctx.sampleStateLabel || 'Unknown';
            const tp = ctx.timepointLabel || '';

            return tp ? `${state} - ${tp}` : state;
        });
    }
}
