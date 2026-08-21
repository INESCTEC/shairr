import { Component, Input, OnChanges } from '@angular/core';
import { RepertoireModel } from 'src/models/airr/repertoire.model';
import {
  StatsHelperService,
  StatsStatusUpdate,
  SampleOption
} from 'src/services/stats-helper.service';
import { DatasourcesApiService } from 'src/services/datasources-api.service';

type RepertoireOption = { key: string; label: string };

type ParsedGeneUsageRow = {
  sample: string;
  gene: string;
  prop?: number;
  count?: number;
};

type GeneUsageRow = {
  repertoireKey: string;
  sampleKey: string;
  sampleLabel: string;
  gene: string;
  prop?: number;
  count?: number;
};

type ViewMode = 'mean' | 'stacked';
type Kind = 'V' | 'J';

@Component({
  selector: 'app-gene-usage',
  templateUrl: './gene-usage.component.html',
  styleUrls: ['./gene-usage.component.scss']
})
export class GeneUsageComponent implements OnChanges {
  @Input() repertoires: RepertoireModel[] = [];
  @Input() kind: Kind = 'V';
  
  ignoreCache = false;
  
  statusBadge: StatsStatusUpdate | null = null;
  
  repertoireOptions: RepertoireOption[] = [];
  selectedRepertoireKey = '*';
  
  sampleOptions: SampleOption[] = [];
  selectedKey = '*';
  
  private labelMap = new Map<string, string>();
  
  view: ViewMode = 'mean';
  topK = 15;
  
  rows: GeneUsageRow[] = [];
  samples: string[] = [];
  genes: string[] = [];
  
  traces: any[] = [];
  layout: Partial<Plotly.Layout> = {
    title: { text: 'Gene usage' },
    xaxis: { title: { text: 'Gene' }, automargin: true },
    yaxis: { title: { text: 'Mean proportion' }, tickformat: '.0%' },
    margin: { t: 40, r: 10, b: 100, l: 60 },
    height: 480
  };
  config: Partial<Plotly.Config> = { responsive: true, displayModeBar: true };
  
  private prevSig = '';
  
  trackByKey = (_: number, o: SampleOption) => o.key;
  
  constructor(
    private api: DatasourcesApiService,
    private statsHelperService: StatsHelperService
  ) {}
  
  ngOnChanges(): void {
    const ids =
    this.repertoires?.flatMap(r =>
      (r.sample || []).flatMap(s =>
        (((s as any)?.rearrangements || []) as any[])
        .map(rr => rr?.id ?? rr?.dataset_id ?? rr?.id_dataset ?? rr?.dataset?.id)
        .filter((x: any) => x != null)
      )
    ) ?? [];
    
    const sig = [this.kind, ...ids.map(String).sort()].join('|');
    
    if (sig === this.prevSig) return;
    this.prevSig = sig;
    
    this.resetGeneUsageView();
    this.runGeneUsage();
  }
  
  onRepertoireChange(value: string) {
    this.selectedRepertoireKey = value;
    this.selectedKey = '*';
    this.refreshSampleOptions();
    this.labelMap = this.buildGeneUsageLabelMap(this.sampleOptions);
    this.updatePlot();
  }
  
  onSampleChange(value: string) {
    this.selectedKey = value;
    this.updatePlot();
  }
  
  onCacheToggle() {
    this.statusBadge = null;
    this.rows = [];
    this.samples = [];
    this.genes = [];
    this.traces = [];
    this.sampleOptions = [];
    this.selectedRepertoireKey = '*';
    this.selectedKey = '*';
    void this.runGeneUsage();
  }
  
  onViewChange(ev: Event) {
    const v = (ev.target as HTMLSelectElement).value as ViewMode;
    this.view = v;
    this.updatePlot();
  }
  
  onTopKChange(ev: Event) {
    const v = Number((ev.target as HTMLInputElement).value);
    this.topK = Number.isFinite(v) && v > 0 ? Math.floor(v) : 15;
    this.updatePlot();
  }
  
  private getRepertoireLabel(r: RepertoireModel): string {
    return (
      r?.subject?.subject_id ||
      r?.repertoire_name ||
      (r as any)?.name ||
      r?.repertoire_id ||
      `Repertoire #${r?.id}`
    );
  }
  private getDatasetContexts(): Array<{
    datasetId: number;
    repertoireKey: string;
    repertoireLabel: string;
    sampleKey: string;
    sampleLabel: string;
    sampleIdRaw: string;
  }> {
    const out: Array<{
      datasetId: number;
      repertoireKey: string;
      repertoireLabel: string;
      sampleKey: string;
      sampleLabel: string;
      sampleIdRaw: string;
    }> = [];
    
    for (const r of this.repertoires || []) {
      const repertoireKey = String(r.repertoire_id);
      const repertoireLabel = this.getRepertoireLabel(r);
      
      for (const s of r.sample || []) {
        const sampleIdentity = this.getSampleIdentity(s);
        const sampleKey = `${repertoireKey}::${sampleIdentity}`;
        const sampleLabel = this.getSampleLabel(s, r);
        
        const candidates = this.getSampleCandidates(s);
        const sampleIdRaw = candidates[0] || sampleIdentity;
        
        for (const rr of (((s as any)?.rearrangements || []) as any[])) {
          const datasetId =
          rr?.id ??
          rr?.dataset_id ??
          rr?.id_dataset ??
          rr?.dataset?.id;
          
          if (datasetId == null) continue;
          
          out.push({
            datasetId: Number(datasetId),
            repertoireKey,
            repertoireLabel,
            sampleKey,
            sampleLabel,
            sampleIdRaw: String(sampleIdRaw)
          });
        }
      }
    }
    
    return out;
  }
  
  private buildRepertoireOptions(): RepertoireOption[] {
    return (this.repertoires || []).map(r => ({
      key: String(r.repertoire_id),
      label: this.getRepertoireLabel(r)
    }));
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
  
  private getSampleCandidates(sample: any): string[] {
    const sx = sample as any;
    
    const base = [
      sx?.name,
      sx?.sample_processing_id,
      sx?.sample_id,
      sx?.id
    ];
    
    const rearrangementBits = (((sx?.rearrangements || []) as any[])).flatMap(rr => [
      rr?.filename,
      rr?.id,
      rr?.dataset_id,
      rr?.id_dataset,
      rr?.dataset?.id
    ]);
    
    return [...base, ...rearrangementBits]
    .filter(v => v != null && String(v).trim() !== '')
    .map(v => String(v).trim());
  }
  
  private resolveParsedSample(
    rawSample: string
  ): { repertoireKey: string; sampleKey: string; sampleLabel: string } {
    const norm = (s: string) => this.statsHelperService.norm(s);
    const raw = String(rawSample ?? '').trim();
    const rawNorm = norm(raw);
    
    for (const rep of this.repertoires || []) {
      for (const s of rep.sample || []) {
        const candidates = this.getSampleCandidates(s);
        
        if (candidates.some(v => v === raw || norm(v) === rawNorm)) {
          const repertoireKey = String(rep.id);
          const sampleIdentity = this.getSampleIdentity(s);
          
          return {
            repertoireKey,
            sampleKey: `${repertoireKey}::${sampleIdentity}`,
            sampleLabel: this.getSampleLabel(s, rep)
          };
        }
      }
    }
    
    return {
      repertoireKey: 'unknown',
      sampleKey: `unknown::${raw}`,
      sampleLabel: raw || 'Sample'
    };
  }
  
  private buildSampleOptionsFromRows(rows: GeneUsageRow[]): SampleOption[] {
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
  
  private buildGeneUsageLabelMap(options?: SampleOption[]): Map<string, string> {
    const map = new Map<string, string>();
    
    for (const o of options || []) {
      map.set(String(o.key), o.label);
      map.set(this.statsHelperService.norm(o.key), o.label);
    }
    
    for (const r of this.repertoires || []) {
      const repLabel = this.getRepertoireLabel(r);
      
      if (r?.id != null) {
        map.set(String(r.repertoire_id), repLabel);
        map.set(this.statsHelperService.norm(String(r.repertoire_id)), repLabel);
      }
      
      const subj = r?.subject?.subject_id;
      if (subj) {
        map.set(String(subj), repLabel);
        map.set(this.statsHelperService.norm(String(subj)), repLabel);
      }
      
      for (const s of r.sample || []) {
        const sampleLabel = this.getSampleLabel(s, r);
        const sampleIdentity = this.getSampleIdentity(s);
        const sampleKey = `${r.repertoire_id}::${sampleIdentity}`;
        
        map.set(sampleKey, sampleLabel);
        map.set(this.statsHelperService.norm(sampleKey), sampleLabel);
        
        for (const raw of this.getSampleCandidates(s)) {
          map.set(raw, sampleLabel);
          map.set(this.statsHelperService.norm(raw), sampleLabel);
        }
      }
    }
    
    return map;
  }
  
  private async getStatsDatasetIds(): Promise<number[]> {
    const ids =
    this.repertoires?.flatMap(r =>
      (r.sample || []).flatMap(s =>
        (((s as any)?.rearrangements || []) as any[])
        .map(rr => rr?.id ?? rr?.dataset_id ?? rr?.id_dataset ?? rr?.dataset?.id)
        .filter((x: any) => x != null)
      )
    ) ?? [];
    
    return Array.from(new Set(ids.map(Number).filter(Number.isFinite)));
  }
  
  private refreshSampleOptions() {
    const rows =
    this.selectedRepertoireKey === '*'
    ? this.rows
    : this.rows.filter(r => r.repertoireKey === this.selectedRepertoireKey);
    
    this.sampleOptions = this.buildSampleOptionsFromRows(rows);
    
    if (
      this.selectedKey !== '*' &&
      !this.sampleOptions.some(o => o.key === this.selectedKey)
    ) {
      this.selectedKey = '*';
    }
  }
  
  private resetGeneUsageView() {
    this.repertoireOptions = this.buildRepertoireOptions();
    this.sampleOptions = [];
    this.selectedRepertoireKey = '*';
    this.selectedKey = '*';
    this.labelMap = this.buildGeneUsageLabelMap();
    
    this.statusBadge = null;
    
    this.rows = [];
    this.samples = [];
    this.genes = [];
    this.traces = [];
    this.view = 'mean';
    this.topK = 15;
    this.layout = {
      ...this.layout,
      title: { text: 'Gene usage' },
      xaxis: { title: { text: 'Gene' }, automargin: true },
      yaxis: { title: { text: 'Mean proportion' }, tickformat: '.0%' },
      barmode: undefined,
      height: 480,
      margin: { t: 40, r: 10, b: 100, l: 60 }
    };
  }
  
  private async runGeneUsage() {
    const rearrangementIds = await this.getStatsDatasetIds();
    
    if (!rearrangementIds.length) {
      this.resetGeneUsageView();
      return;
    }
    
    try {
      const finalDatasets = await this.statsHelperService.requestStatsComputationFromServer(
        rearrangementIds,
        ['gene_usage'],
        this.repertoires,
        (partial: any) => {
          void this.processGeneUsageDatasets(partial);
        },
        (status: any) => {
          this.statusBadge = status;
        },
        this.ignoreCache
      );
      
      await this.processGeneUsageDatasets(finalDatasets);
    } catch (err) {
      console.error('Error while requesting gene usage stats:', err);
      this.resetGeneUsageView();
    }
  }
  
  private async processGeneUsageDatasets(datasets: any[]): Promise<void> {
    if (!datasets?.length) {
      this.resetGeneUsageView();
      return;
    }
    
    const U = (s: string) => this.statsHelperService.unquote(s);
    const kind = this.kind;
    
    const ctxs = this.getDatasetContexts();
    const aliasMap = new Map<string, {
      repertoireKey: string;
      sampleKey: string;
      sampleLabel: string;
    }>();
    const ctxByDatasetId = new Map<number, {
      repertoireKey: string;
      sampleKey: string;
      sampleLabel: string;
    }>();
    
    const addAlias = (
      key: string | undefined | null,
      ctx: { repertoireKey: string; sampleKey: string; sampleLabel: string }
    ) => {
      const raw = String(key ?? '').trim();
      if (!raw) return;
      aliasMap.set(raw, ctx);
      aliasMap.set(this.statsHelperService.norm(raw), ctx);
      aliasMap.set(raw.toLowerCase(), ctx);
    };
    
    for (const ctx of ctxs) {
      const slim = {
        repertoireKey: ctx.repertoireKey,
        sampleKey: ctx.sampleKey,
        sampleLabel: ctx.sampleLabel
      };
      
      ctxByDatasetId.set(ctx.datasetId, slim);
      
      addAlias(ctx.sampleKey, slim);
      addAlias(ctx.sampleLabel, slim);
      addAlias(ctx.repertoireKey, slim);
      addAlias(ctx.repertoireLabel, slim);
      addAlias(String(ctx.datasetId), slim);
      addAlias(ctx.sampleIdRaw, slim);
    }
    
    for (const r of this.repertoires || []) {
      for (const s of r.sample || []) {
        const repertoireKey = String(r.repertoire_id);
        const sampleIdentity = this.getSampleIdentity(s);
        const sampleKey = `${repertoireKey}::${sampleIdentity}`;
        const sampleLabel = this.getSampleLabel(s, r);
        
        const slim = { repertoireKey, sampleKey, sampleLabel };
        
        addAlias(String((s as any)?.id ?? ''), slim);
        addAlias(String((s as any)?.sample_id ?? ''), slim);
        addAlias(String((s as any)?.sample_processing_id ?? ''), slim);
        addAlias(String((s as any)?.name ?? ''), slim);
        
        for (const rr of (((s as any)?.rearrangements || []) as any[])) {
          addAlias(
            String(rr?.id ?? rr?.dataset_id ?? rr?.id_dataset ?? rr?.dataset?.id ?? ''),
            slim
          );
          addAlias(String(rr?.filename ?? ''), slim);
        }
      }
    }
    
    const usageBodies: Array<{ ds: any; body: string }> = [];
    
    for (const ds of datasets ?? []) {
      const body = await this.api.getDatasetRaw(ds.id).catch(() => '');
      if (!body) continue;
      
      const firstLine = body.split(/\r?\n/)[0] || '';
      if (!firstLine) continue;
      
      const d0 = this.statsHelperService.detectDelimiter(firstLine);
      const H0 = this.statsHelperService
      .splitCsvRow(firstLine, d0)
      .map(h => U(h).toLowerCase());
      
      const hasSample = H0.some(h => h.includes('sample') || h.includes('sample_id'));
      const hasPropOrCount = H0.some(h =>
        /(prop|proportion|frequency|freq|count|reads|clones|duplicate_count|umi_count)/.test(h)
      );
      const looksV = H0.some(h => /(v[\._-]?name|v[_ ]?gene|v_call|\bv\b)/.test(h));
      const looksJ = H0.some(h => /(j[\._-]?name|j[_ ]?gene|j_call|\bj\b)/.test(h));
      
      if (!hasSample || !hasPropOrCount) continue;
      if (kind === 'V' && !looksV) continue;
      if (kind === 'J' && !looksJ) continue;
      
      usageBodies.push({ ds, body });
    }
    
    if (!usageBodies.length) {
      this.resetGeneUsageView();
      return;
    }
    
    const geneAliases =
    kind === 'V'
    ? ['V.name', 'v_gene', 'v_call', 'v']
    : ['J.name', 'j_gene', 'j_call', 'j'];
    
    const resolvedRows: GeneUsageRow[] = [];
    
    for (const { ds, body } of usageBodies) {
      const parsed = this.parseGeneUsageLong(body, geneAliases);
      if (!parsed.length) continue;
      
      const sourceRearrangementId = Number((ds as any)?._sourceRearrangementId ?? '');
      const defaultCtx =
      Number.isFinite(sourceRearrangementId)
      ? ctxByDatasetId.get(sourceRearrangementId)
      : undefined;
      
      for (const r of parsed) {
        const rawSample = String(r.sample ?? '').trim();
        
        const resolved =
        aliasMap.get(rawSample) ||
        aliasMap.get(this.statsHelperService.norm(rawSample)) ||
        aliasMap.get(rawSample.toLowerCase()) ||
        defaultCtx;
        
        resolvedRows.push({
          repertoireKey: resolved?.repertoireKey || 'unknown',
          sampleKey: resolved?.sampleKey || `unknown::${rawSample}`,
          sampleLabel: resolved?.sampleLabel || rawSample || 'Sample',
          gene: r.gene,
          prop: r.prop,
          count: r.count
        });
      }
    }
    
    if (!resolvedRows.length) {
      this.resetGeneUsageView();
      return;
    }
    
    this.rows = resolvedRows;
    this.refreshSampleOptions();
    this.labelMap = this.buildGeneUsageLabelMap(this.sampleOptions);
    
    const optionKeys = this.sampleOptions.map(o => o.key);
    if (!this.selectedKey || !optionKeys.includes(this.selectedKey)) {
      this.selectedKey = '*';
    }
    
    const s = new Set<string>();
    const g = new Set<string>();
    
    this.rows.forEach(r => {
      s.add(r.sampleKey);
      g.add(r.gene);
    });
    
    this.samples = Array.from(s).sort();
    this.genes = Array.from(g).sort();
    
    this.updatePlot();
  }
  
  private updatePlot() {
    const kind = this.kind;
    
    if (!this.rows.length) {
      this.traces = [];
      return;
    }
    console.log('[GENE_USAGE] repertoire keys in rows:', Array.from(new Set(this.rows.map(r => r.repertoireKey))));
    console.log('[GENE_USAGE] selectedRepertoireKey:', this.selectedRepertoireKey);
    console.log('[GENE_USAGE] sample options:', this.sampleOptions);
    
    let rows = this.rows;
    
    if (this.selectedRepertoireKey !== '*') {
      rows = rows.filter(r => r.repertoireKey === this.selectedRepertoireKey);
    }
    
    if (this.selectedKey !== '*') {
      rows = rows.filter(r => r.sampleKey === this.selectedKey);
    }
    
    if (!rows.length) {
      this.traces = [];
      return;
    }
    
    const selectedSamples = Array.from(
      new Set(rows.map(r => r.sampleKey))
    ).sort();
    
    const selectedGenes = Array.from(
      new Set(rows.map(r => r.gene))
    ).sort();
    
    let plotRows = rows.slice();
    
    const hasProp = plotRows.some(r => Number.isFinite(r.prop as number));
    if (!hasProp) {
      const totals = new Map<string, number>();
      
      for (const sampleKey of selectedSamples) {
        const tot = plotRows
        .filter(r => r.sampleKey === sampleKey)
        .reduce((a, b) => a + (b.count ?? 0), 0);
        
        totals.set(sampleKey, tot || 1);
      }
      
      plotRows = plotRows.map(r => ({
        ...r,
        prop: (r.count ?? 0) / (totals.get(r.sampleKey) || 1)
      }));
    }
    
    const meanByGene = new Map<string, number>();
    for (const gene of selectedGenes) {
      const vals = selectedSamples.map(sampleKey =>
        plotRows.find(r => r.sampleKey === sampleKey && r.gene === gene)?.prop ?? 0
      );
      const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
      meanByGene.set(gene, mean);
    }
    
    const topGenes = Array.from(meanByGene.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, this.topK)
    .map(([g]) => g);
    
    if (this.view === 'mean') {
      const labels = topGenes;
      const values = labels.map(g => meanByGene.get(g) || 0);
      
      const maxLen = labels.reduce((m, s) => Math.max(m, s?.length ?? 0), 0);
      const useHorizontal = maxLen >= 16;
      
      if (useHorizontal) {
        const y = labels.slice().reverse();
        const x = values.slice().reverse();
        
        this.traces = [
          {
            type: 'bar',
            orientation: 'h',
            y,
            x,
            text: x.map(v => `${(v * 100).toFixed(1)}%`),
            textposition: 'auto',
            hovertemplate: `${kind} gene: %{y}<br>Mean: %{x:.1%}<extra></extra>`
          }
        ];
        
        this.layout = {
          ...this.layout,
          title: { text: `${kind} gene usage — mean proportion (Top ${this.topK})` },
          xaxis: { title: { text: 'Mean proportion' }, tickformat: '.0%' },
          yaxis: { title: { text: `${kind} gene` }, automargin: true },
          barmode: undefined,
          height: Math.max(520, 28 * labels.length + 120),
          margin: {
            t: 40,
            r: 10,
            b: 40,
            l: Math.min(320, Math.max(160, maxLen * 7))
          }
        };
        return;
      }
      
      this.traces = [
        {
          type: 'bar',
          x: labels,
          y: values,
          hovertemplate: `${kind} gene: %{x}<br>Mean: %{y:.1%}<extra></extra>`
        }
      ];
      
      this.layout = {
        ...this.layout,
        title: { text: `${kind} gene usage — mean proportion (Top ${this.topK})` },
        xaxis: { title: { text: `${kind} gene` }, automargin: true, tickangle: -35 },
        yaxis: { title: { text: 'Mean proportion' }, tickformat: '.0%' },
        barmode: undefined,
        height: 480,
        margin: { t: 40, r: 10, b: 120, l: 60 }
      };
      return;
    }
    
    const norm = (s: string) => this.statsHelperService.norm(s);
    const labelByNormKey = new Map<string, string>(
      this.sampleOptions.map(o => [norm(o.key), o.label || o.key])
    );
    
    const labelFor = (k: string) => labelByNormKey.get(norm(k)) ?? k;
    const xLabels = selectedSamples.map(labelFor);
    
    const traces: any[] = [];
    
    topGenes.forEach(gene => {
      traces.push({
        type: 'bar',
        name: gene,
        x: xLabels,
        y: selectedSamples.map(sampleKey =>
          plotRows.find(r => r.sampleKey === sampleKey && r.gene === gene)?.prop ?? 0
        ),
        hovertemplate: `Sample: %{x}<br>${gene}: %{y:.1%}<extra></extra>`
      });
    });
    
    const others = selectedSamples.map(sampleKey => {
      const sumTop = topGenes.reduce(
        (acc, gene) =>
          acc + (plotRows.find(r => r.sampleKey === sampleKey && r.gene === gene)?.prop ?? 0),
        0
      );
      return Math.max(0, 1 - sumTop);
    });
    
    traces.push({
      type: 'bar',
      name: 'Other',
      x: xLabels,
      y: others,
      hovertemplate: `Sample: %{x}<br>Other: %{y:.1%}<extra></extra>`
    });
    
    this.traces = traces;
    this.layout = {
      ...this.layout,
      title: { text: `${kind} gene usage — stacked by sample (Top ${this.topK} + Other)` },
      xaxis: { title: { text: 'Sample' }, automargin: true },
      yaxis: { title: { text: 'Proportion' }, tickformat: '.0%' },
      barmode: 'stack',
      height: 520,
      margin: { t: 40, r: 10, b: 100, l: 60 }
    };
  }
  
  private parseGeneUsageLong(txt: string, geneAliases: string[]): ParsedGeneUsageRow[] {
    const lines = txt.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    
    const d = this.statsHelperService.detectDelimiter(lines[0]);
    const U = (s: string) => this.statsHelperService.unquote(s);
    const Hraw = this.statsHelperService.splitCsvRow(lines[0], d).map(h => U(h));
    const H = Hraw.map(h => h.toLowerCase());
    
    const find = (...names: string[]) => {
      const tgt = names.map(n => n.toLowerCase());
      return H.findIndex(h => tgt.includes(h) || tgt.some(t => h.includes(t)));
    };
    
    const iSample = find('sample', 'sample_id');
    
    let iGene = -1;
    for (const a of geneAliases) {
      const t = find(a);
      if (t >= 0) {
        iGene = t;
        break;
      }
    }
    
    const iProp = find('prop', 'proportion', 'frequency', 'freq');
    const iCount = find('count', 'reads', 'clones', 'duplicate_count', 'umi_count');
    
    if (iSample < 0 || iGene < 0 || (iProp < 0 && iCount < 0)) return [];
    
    const toNum = (v: any) => {
      if (v == null) return NaN;
      const t = String(v).trim();
      if (!t) return NaN;
      
      if (t.endsWith('%')) {
        const n = Number(t.slice(0, -1));
        return Number.isFinite(n) ? n / 100 : NaN;
      }
      
      const n = Number(t);
      return Number.isFinite(n) ? n : NaN;
    };
    
    const out: ParsedGeneUsageRow[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const cols = this.statsHelperService.splitCsvRow(lines[i], d).map(U);
      const sample = String(cols[iSample] ?? '').trim();
      const gene = String(cols[iGene] ?? '').trim();
      const prop = iProp >= 0 ? toNum(cols[iProp]) : undefined;
      const count = iCount >= 0 ? toNum(cols[iCount]) : undefined;
      
      if (sample && gene && (Number.isFinite(prop) || Number.isFinite(count))) {
        out.push({ sample, gene, prop, count });
      }
    }
    
    return out;
  }
}
