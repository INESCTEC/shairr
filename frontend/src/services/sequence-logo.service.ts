
// Amino acids and a readable color palette by chemistry
export const AA = ['A', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'Y'] as const;
export const AA_COLOR: Record<string, string> = {
    // nonpolar / hydrophobic
    A: '#a6cee3', V: '#1f78b4', I: '#b2df8a', L: '#33a02c', M: '#fb9a99', F: '#e31a1c', W: '#fdbf6f', P: '#ff7f00', G: '#cab2d6',
    // polar uncharged
    S: '#6a3d9a', T: '#ffff99', N: '#b15928', Q: '#9c6f6f', C: '#66c2a5',
    // charged
    K: '#3288bd', R: '#5e4fa2', H: '#542788', D: '#d53e4f', E: '#f46d43',
    Y: '#7fc97f'
};


export class SequenceLogoService {

    // Compute per-position frequencies and information content (bits)
    // For proteins, max info is log2(20) ≈ 4.322
    static computeLogo(peptides: string[]) {
        const clean = peptides.filter(p => !!p && /^[ACDEFGHIKLMNPQRSTVWY]+$/.test(p));
        if (clean.length === 0) return { posFreq: [], posBits: [], L: 0, n: 0 };

        const L = clean[0].length;
        const sameLen = clean.filter(p => p.length === L);
        const n = sameLen.length;
        const log2 = (x: number) => Math.log(x) / Math.log(2);
        const MAX_BITS = log2(20);

        // initialize
        const posFreq: Array<Record<string, number>> = Array.from({ length: L }, () => Object.fromEntries(AA.map(a => [a, 0])) as Record<string, number>);

        // count
        for (const p of sameLen) {
            for (let i = 0; i < L; i++) {
                const a = p[i] as typeof AA[number];
                posFreq[i][a] += 1;
            }
        }
        // normalize + bits per position
        const posBits: number[] = [];
        for (let i = 0; i < L; i++) {
            let H = 0;
            for (const a of AA) {
                const p = posFreq[i][a] / n;
                posFreq[i][a] = p;
                if (p > 0) H += -p * log2(p);
            }
            posBits[i] = Math.max(0, MAX_BITS - H); // information content at position i
        }
        return { posFreq, posBits, L, n };
    }

    // Overall amino-acid composition across peptides
    static computeAAFrequency(peptides: string[]) {
        const counts: Record<string, number> = Object.fromEntries(AA.map(a => [a, 0])) as Record<string, number>;
        let total = 0;
        for (const p of peptides) {
            if (!p) continue;
            for (const ch of p) {
                if (AA.includes(ch as any)) { counts[ch]++; total++; }
            }
        }
        const freqs = AA.map(a => ({ aa: a, count: counts[a], frac: total ? counts[a] / total : 0 }));
        freqs.sort((a, b) => b.frac - a.frac); // sort descending by frequency (nice for the bar)
        return freqs;
    }

    static computeLogoWeighted(peptides: string[], weights: number[]) {
        const clean: string[] = [];
        const cleanWeights: number[] = [];

        // filter & align
        for (let i = 0; i < peptides.length; i++) {
            const p = peptides[i];
            if (p && /^[ACDEFGHIKLMNPQRSTVWY]+$/.test(p)) {
                clean.push(p);
                cleanWeights.push(weights[i] ?? 1);
            }
        }
        if (clean.length === 0) return { posFreq: [], posBits: [], L: 0, n: 0 };

        const L = clean[0].length;
        const sameLen: string[] = [];
        const sameWeights: number[] = [];
        for (let i = 0; i < clean.length; i++) {
            if (clean[i].length === L) {
                sameLen.push(clean[i]);
                sameWeights.push(cleanWeights[i]);
            }
        }

        const n = sameLen.length;
        const log2 = (x: number) => Math.log(x) / Math.log(2);
        const MAX_BITS = log2(20);

        // initialize counts
        const posFreq: Array<Record<string, number>> = Array.from({ length: L },
            () => Object.fromEntries(AA.map(a => [a, 0])) as Record<string, number>
        );

        // weighted counts
        for (let j = 0; j < n; j++) {
            const p = sameLen[j];
            const w = sameWeights[j];
            for (let i = 0; i < L; i++) {
                const a = p[i] as typeof AA[number];
                posFreq[i][a] += w;
            }
        }

        // normalize to weighted frequencies + compute bits
        const posBits: number[] = [];
        for (let i = 0; i < L; i++) {
            const col = posFreq[i];
            const totalW = Object.values(col).reduce((acc, v) => acc + v, 0);
            let H = 0;
            for (const a of AA) {
                const p = totalW ? col[a] / totalW : 0;
                col[a] = p;
                if (p > 0) H += -p * log2(p);
            }
            posBits[i] = Math.max(0, MAX_BITS - H);
        }
        return { posFreq, posBits, L, n };
    }

}