import { Injectable } from '@angular/core';
import { RepertoireModel } from 'src/models/airr/repertoire.model';
import { DatasetModel } from 'src/models/shairr/dataset.model';
import { DatasourcesApiService } from './datasources-api.service';

export type SampleOption = { key: string; label: string };

export type StatsStatusKind = 'loading-cache' | 'computing';

export interface StatsStatusUpdate {
    kind: StatsStatusKind;
    rearrangementId: number;
    repertoireLabel?: string;
    message: string; // e.g. "Computing repertoire X"
}

@Injectable({ providedIn: 'root' })
export class StatsHelperService {
    constructor(private api: DatasourcesApiService) {}

    // --- CSV UTILITIES ---

    /** Detects the delimiter from the header line */
    detectDelimiter(headLine: string): string {
        const s = headLine.replace(/^\uFEFF/, ''); // remove BOM
        const cand = ['\t', ',', ';', '|'];
        return cand.sort(
            (a, b) => s.split(b).length - 1 - (s.split(a).length - 1),
        )[0];
    }

    /** Removes quotes and trims a string */
    unquote(s: string): string {
        return s
            .trim()
            .replace(/^"(.*)"$/, '$1')
            .replace(/^'(.*)'$/, '$1');
    }

    splitCsvRow(line: string, d: string): string[] {
        const out: string[] = [];
        let cur = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];

            if (ch === '"') {
                // handle escaped quotes inside a quoted field ("")
                if (inQuotes && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === d && !inQuotes) {
                out.push(cur);
                cur = '';
            } else {
                cur += ch;
            }
        }
        out.push(cur);
        return out;
    }

    // --- LABEL MAP UTILITIES ---

    /** Normalize a filename / sample key for matching */
    norm(s?: string | null): string {
        const x = (s ?? '').trim();
        if (!x) return '';
        const base = x.split('/').pop() || x;
        return base.replace(/\.[^.]+$/, '').toLowerCase();
    }

    /** Build dropdown options (keys + friendly labels) */
    buildOptionsFromKeys(
        keys: string[],
        reps: RepertoireModel[],
    ): SampleOption[] {
        const byId = new Map(reps.map((r) => [String(r.id), r]));
        const bySubject = new Map(
            reps.map((r) => [String(r?.subject?.subject_id ?? ''), r]),
        );
        return keys.map((k, idx) => {
            const r = byId.get(k) || bySubject.get(k) || reps[idx];
            const label =
                r?.subject?.subject_id ||
                r?.repertoire_name ||
                r.sample?.[0]?.sample_id ||
                `Repertoire #${r?.id ?? ''}`;
            return { key: k, label };
        });
    }

    /** Build a label map (key -> friendly name) from repertoires and options */
    buildLabelMap(
        reps: RepertoireModel[],
        options?: SampleOption[],
    ): Map<string, string> {
        const map = new Map<string, string>();

        for (const o of options || []) {
            map.set(String(o.key), o.label);
            map.set(this.norm(o.key), o.label);
        }

        for (const r of reps || []) {
            const repLabel =
                r?.subject?.subject_id ||
                r?.repertoire_name ||
                (r as any)?.name ||
                `Repertoire #${r?.id}`;

            if (r?.id != null) {
                map.set(String(r.id), repLabel);
                map.set(this.norm(String(r.id)), repLabel);
            }

            const subj = r?.subject?.subject_id;
            if (subj) {
                map.set(String(subj), repLabel);
                map.set(this.norm(String(subj)), repLabel);
            }

            for (const s of r.sample || []) {
                const rawSampleId = String((s as any)?.sample_id ?? '').trim();
                const procId = String(
                    (s as any)?.sample_processing_id ?? '',
                ).trim();
                const sid = String((s as any)?.id ?? '').trim();

                const sampleLabel = procId || rawSampleId || repLabel;

                const sampleKey = `${r.id}::${rawSampleId || sid}`;

                if (rawSampleId) {
                    map.set(rawSampleId, sampleLabel);
                    map.set(this.norm(rawSampleId), sampleLabel);
                }

                if (procId) {
                    map.set(procId, sampleLabel);
                    map.set(this.norm(procId), sampleLabel);
                }

                if (sid) {
                    map.set(sid, sampleLabel);
                    map.set(this.norm(sid), sampleLabel);
                }

                map.set(sampleKey, sampleLabel);
                map.set(this.norm(sampleKey), sampleLabel);

                for (const ds of ((s as any)?.rearrangements ||
                    []) as DatasetModel[]) {
                    const dsId = String((ds as any)?.id ?? '').trim();
                    const filename = String((ds as any)?.filename ?? '').trim();

                    if (dsId) {
                        map.set(dsId, sampleLabel);
                        map.set(this.norm(dsId), sampleLabel);
                    }

                    if (filename) {
                        map.set(filename, sampleLabel);
                        map.set(this.norm(filename), sampleLabel);
                    }
                }
            }
        }

        return map;
    }

    /** Resolve a single key into a human-readable label */
    resolveLabel(key: string, labelMap: Map<string, string>): string {
        const k = this.norm(key);
        return labelMap.get(k) || labelMap.get(String(key)) || String(key);
    }

    /** Map all axis keys to their labels */
    mapAxis(keys: string[], labelMap: Map<string, string>): string[] {
        return keys.map((k) => this.resolveLabel(k, labelMap));
    }

    basenameLower(path: string): string {
        const raw = (path ?? '').toString();
        const base = raw.split('/').pop()?.split('\\').pop() || raw;
        return base.toLowerCase();
    }

    async requestStatsComputationFromServer(
        rearrangementIds: number[],
        selectedStats: string[],
        repertoires?: RepertoireModel[],
        onPartial?: (datasets: any[]) => void,
        onStatusChange?: (status: StatsStatusUpdate | null) => void,
        ignoreCache: boolean = false,
        singleRequestPerRepertoire: boolean = true,
    ): Promise<any[]> {
        // Map input dataset id -> friendly repertoire label
        const labelByRearrId = new Map<number, string>();

        if (repertoires?.length && rearrangementIds.length) {
            for (const r of repertoires) {
                const repLabel =
                    r?.repertoire_name ||
                    r?.subject?.subject_id ||
                    `Repertoire #${r?.id ?? ''}`;

                for (const s of r.sample || []) {
                    const sampleLabel =
                        String((s as any)?.sample_processing_id ?? '').trim() ||
                        String((s as any)?.sample_id ?? '').trim() ||
                        repLabel;

                    for (const ds of ((s as any)?.rearrangements ||
                        []) as any[]) {
                        if (ds?.id != null) {
                            labelByRearrId.set(ds.id, sampleLabel);
                        }
                    }
                }
            }
        }

        const tasks: {
            servedFromCache: boolean;
            taskId?: number;
            cachedResult?: any[];
            done?: boolean;
            rearrangementId: number;
            repertoireLabel?: string;
        }[] = [];

        const accumulated: any[] = [];

        // Kick off one task per input dataset (or hit cache)
        if (singleRequestPerRepertoire) {
            for (const rearrangementId of rearrangementIds) {
                const stats_result = await this.api.createImmunarchStatsTask(
                    [rearrangementId],
                    selectedStats,
                    ignoreCache,
                );

                await this.handleStatsResponse(
                    stats_result,
                    rearrangementId,
                    selectedStats,
                    labelByRearrId,
                    tasks,
                    accumulated,
                    onStatusChange,
                    onPartial,
                );
            }
        } else {
            const stats_result = await this.api.createImmunarchStatsTask(
                rearrangementIds,
                selectedStats,
                ignoreCache,
            );

            for (const rearrangementId of rearrangementIds) {
                await this.handleStatsResponse(
                    stats_result,
                    rearrangementId,
                    selectedStats,
                    labelByRearrId,
                    tasks,
                    accumulated,
                    onStatusChange,
                    onPartial,
                );
            }
        }

        const t0 = Date.now();

        // Poll non-cached tasks until all finished
        let allFinished = false;
        while (!allFinished) {
            allFinished = true;

            for (const task of tasks) {
                if (task.servedFromCache || task.done) continue;

                const t = await this.api
                    .getTask(task.taskId!)
                    .then((res: any) => {
                        return res.json();
                    });

                if (t.status === 'FINISHED') {
                    // Use the existing t object - don't fetch again
                    const result = (t.datasets ?? []).map((d: any) => ({
                        ...d,
                        _sourceRearrangementId: task.rearrangementId,
                    }));
                    task.cachedResult = result;
                    task.done = true;

                    if (result.length > 0) {
                        accumulated.push(...result);
                        onPartial?.(accumulated.slice());
                    }

                    onStatusChange?.({
                        kind: 'computing',
                        rearrangementId: task.rearrangementId,
                        repertoireLabel: task.repertoireLabel,
                        message: task.repertoireLabel
                            ? `Completed ${task.repertoireLabel}`
                            : `Completed repertoire ${task.rearrangementId}`,
                    });
                } else if (t.status === 'PENDING' || t.status === 'RUNNING') {
                    allFinished = false;

                    const label = task.repertoireLabel;
                    onStatusChange?.({
                        kind: 'computing',
                        rearrangementId: task.rearrangementId,
                        repertoireLabel: label,
                        message: label
                            ? `Computing repertoire ${label}`
                            : `Computing repertoire ${task.rearrangementId}`,
                    });
                } else {
                    throw new Error('Stats task finished with error on server');
                }
            }

            if (!allFinished) {
                if (Date.now() - t0 > 10 * 60 * 1000) {
                    throw new Error('Stats task timed out');
                }
                await new Promise((r) => setTimeout(r, 1500));
            }
        }

        onStatusChange?.(null);
        return accumulated;
    }
    private async handleStatsResponse(
        stats_result: any,
        rearrangementId: number,
        selectedStats: string[],
        labelByRearrId: Map<number, string>,
        tasks: {
            servedFromCache: boolean;
            taskId?: number;
            cachedResult?: any[];
            done?: boolean;
            rearrangementId: number;
            repertoireLabel?: string;
        }[],
        accumulated: any[],
        onStatusChange?: (status: StatsStatusUpdate | null) => void,
        onPartial?: (datasets: any[]) => void,
    ) {
        const label = labelByRearrId.get(rearrangementId);

        // Parse if it's a Response object
        let data = stats_result;
        if (stats_result instanceof Response) {
            data = await stats_result.json();
        }

        console.log('=== handleStatsResponse ===');
        console.log('Is from cache?', data.served_from_cache);

        if (data.served_from_cache === true) {
            // CACHE HIT - use the cached results directly
            console.log('Cache hit! Processing cached results...');
            console.log('Raw result_datasets:', data.result_datasets);
            console.log('Number of datasets:', data.result_datasets?.length);

            // Log each dataset to see its structure
            if (data.result_datasets && data.result_datasets.length) {
                data.result_datasets.forEach((dataset: any, index: number) => {
                    console.log(`Dataset ${index}:`, dataset);
                    console.log(`  Keys:`, Object.keys(dataset));
                    if (dataset.data) {
                        console.log(`  Data sample:`, dataset.data.slice(0, 5));
                    }
                    if (dataset.Length) {
                        console.log(`  Has Length/Count arrays`);
                    }
                });
            }

            const result = (data.result_datasets ?? []).map((d: any) => ({
                ...d,
                _sourceRearrangementId: rearrangementId,
            }));

            console.log('Mapped result:', result);

            tasks.push({
                servedFromCache: true,
                cachedResult: result,
                done: true,
                rearrangementId,
                repertoireLabel: label,
            });

            accumulated.push(...result);
            console.log('Accumulated after push:', accumulated);

            onStatusChange?.({
                kind: 'loading-cache',
                rearrangementId,
                repertoireLabel: label,
                message: label
                    ? `Loading repertoire ${label} from cache`
                    : `Loading repertoire ${rearrangementId} from cache`,
            });

            console.log('Calling onPartial with:', accumulated.slice());
            onPartial?.(accumulated.slice());
        } else {
            // CACHE MISS - need to poll for task completion
            console.log('Cache miss, task ID:', data.task_response?.id);

            if (!data.task_response || !data.task_response.id) {
                throw new Error('Server response missing task information');
            }

            tasks.push({
                servedFromCache: false,
                taskId: data.task_response.id,
                done: false,
                rearrangementId,
                repertoireLabel: label,
            });
        }
    }
    /** Resolve which repertoire a key corresponds to */
    resolveRepertoireForKey(
        key: string,
        reps: RepertoireModel[],
        fallbackIndex?: number,
    ): RepertoireModel | undefined {
        const byId = new Map(reps.map((r) => [String((r as any).id), r]));
        const bySubject = new Map(
            reps.map((r) => [String((r as any)?.subject?.subject_id ?? ''), r]),
        );

        return (
            byId.get(String(key)) ||
            bySubject.get(String(key)) ||
            (fallbackIndex != null ? reps[fallbackIndex] : undefined)
        );
    }

    /** Extract unique disease states for a repertoire (may have multiple samples) */
    getDiseaseStates(rep?: RepertoireModel): string[] {
        const states = ((rep as any)?.sample ?? [])
            .map((s: any) => String(s?.disease_state_sample ?? '').trim())
            .filter(
                (v: string) =>
                    !!v &&
                    v.toLowerCase() !== 'none' &&
                    v.toLowerCase() !== 'null',
            );

        return Array.from(new Set(states));
    }

    sortKeysByDisease(
        keys: string[],
        diseaseByKey: Map<string, string>,
        labelMap?: Map<string, string>,
    ): string[] {
        const diseaseSortKey = (d?: string) => {
            const t = (d ?? '').trim();
            if (!t || t.toLowerCase() === 'unknown') return '~~~~unknown'; // last
            return t.toLowerCase();
        };

        const enriched = keys.map((k, idx) => {
            const disease = diseaseByKey.get(k) || 'Unknown';
            const label = labelMap?.get(k) ?? k;
            return { k, idx, disease, label };
        });

        enriched.sort((a, b) => {
            const da = diseaseSortKey(a.disease);
            const db = diseaseSortKey(b.disease);
            if (da < db) return -1;
            if (da > db) return 1;

            // secondary sort: label
            const la = (a.label ?? '').toLowerCase();
            const lb = (b.label ?? '').toLowerCase();
            if (la < lb) return -1;
            if (la > lb) return 1;

            // final: original order
            return a.idx - b.idx;
        });

        return enriched.map((e) => e.k);
    }

    reorderSquareMatrix<T>(
        matrix: T[][],
        oldKeys: string[],
        newKeys: string[],
    ): T[][] {
        const oldPos = new Map(oldKeys.map((k, i) => [k, i]));
        const perm = newKeys.map((k) => oldPos.get(k)!);
        return perm.map((i) => perm.map((j) => matrix[i][j]));
    }
}
