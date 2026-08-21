import { Injectable } from '@angular/core';
import { ParamMap } from '@angular/router';
import { Papa, UnparseConfig } from 'ngx-papaparse';
import stc from 'string-to-color';

export type Transforms<S, T> = { [K in keyof T]?: (src: S) => T[K] };

@Injectable({
    providedIn: 'root'
})
export class UtilitiesService {
    // Based on
    //  - https://stackoverflow.com/questions/161738/what-is-the-best-regular-expression-to-check-if-a-string-is-a-valid-url/8234912#8234912
    static urlRegex: RegExp = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/;

    /**
     * Format bytes as human-readable text.
     *
     * Based on
     *  - https://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable-string/14919494#14919494
     *
     * @param bytes Number of bytes.
     * @param si True to use metric (SI) units, aka powers of 1000. False to use
     *           binary (IEC), aka powers of 1024.
     * @param dp Number of decimal places to display.
     *
     * @return Formatted string.
     */
    static humanFileSize(bytes: number, si: boolean = false, dp: number = 1) {
        const thresh = si ? 1000 : 1024;

        if (Math.abs(bytes) < thresh) {
            return bytes + ' B';
        }

        const units = si
            ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
            : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

        let u = -1;
        const r = 10 ** dp;

        do {
            bytes /= thresh;
            ++u;
        } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

        return bytes.toFixed(dp) + ' ' + units[u];
    }

    static toNumberArray(input: unknown): number[] {
        if (Array.isArray(input)) {
            return input.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
        }
        if (typeof input === 'number' && Number.isFinite(input)) {
            return [input];
        }
        return [];
    }

    static roundToOneDecimal(number: number) {
        // Convert to absolute value for processing, store sign
        const isNegative = number < 0;
        const absNum = Math.abs(number);

        // Handle very small numbers (less than 1000)
        if (absNum < 1000) {
            // If number is already less than 1000, just format with one decimal
            return (isNegative ? '-' : '') + absNum.toFixed(1).replace(/\.?0+$/, '');
        }

        // Determine the scale (K, M, etc.)
        const numStr = Math.floor(absNum).toString();
        const numDigits = numStr.length;

        let divisor, suffix;

        if (numDigits <= 6) {
            // Thousands (3-6 digits)
            divisor = 1000;
            suffix = 'K';
        } else if (numDigits <= 9) {
            // Millions (7-9 digits)
            divisor = 1000000;
            suffix = 'M';
        } else if (numDigits <= 12) {
            // Billions (10-12 digits)
            divisor = 1000000000;
            suffix = 'B';
        } else {
            // Trillions and beyond
            divisor = 1000000000000;
            suffix = 'T';
        }

        // Divide and round to one decimal place
        const divided = absNum / divisor;
        const rounded = Math.round(divided * 10) / 10;

        // Format to remove trailing .0 if present
        let result = rounded.toString();
        if (result.includes('.')) {
            // Remove trailing zeros after decimal
            result = result.replace(/\.0+$/, '').replace(/(\..*?)0+$/, '$1');
            // Ensure we only have one decimal place max
            const decimalParts = result.split('.');
            if (decimalParts[1] && decimalParts[1].length > 1) {
                result = decimalParts[0] + '.' + decimalParts[1].charAt(0);
            }
        }

        // Add suffix and sign
        return (isNegative ? '-' : '') + result + suffix;
    }

    static getFileExtension(filename: string) {
        const ext = filename.split('.').pop();

        if (ext == filename) {
            return "";
        }

        return ext;
    }

    static generateMHCBadgeColor(mhc: string) {
        return stc(mhc + ' peacock manganeseblue violet');
    }

    static deepMerge(target: any, ...sources: any[]): any {
        if (!sources.length) return target;
        const source = sources.shift();

        const isObject = (item: any) => {
            return (item && typeof item === 'object' && !Array.isArray(item))
        };

        if (isObject(target) && isObject(source)) {
            for (const key in source) {
                if (isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    UtilitiesService.deepMerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        return UtilitiesService.deepMerge(target, ...sources);
    }

    /**
     * Trim an MHC allele to N fields after the first '*'.
     * - Species/locus prefix is preserved (i.e., "HLA-A", "BoLA-DRB3", "SLA-1").
     * - Keeps a trailing expression suffix (N/L/S/C/A/Q) if not cut off.
     * - If the string has no '*', or n <= 0, it is returned unchanged.
     */
    static trimMHCAllele(allele: string, n: number = 2): string {
        if (n <= 0) return allele;
        const star = allele.indexOf("*");
        if (star < 0) return allele;

        const left = allele.slice(0, star + 1);
        let right = allele.slice(star + 1);

        // Pull off a single trailing expression suffix (e.g., N, L, S, C, A, Q)
        let suffix = "";
        const sufMatch = right.match(/(N|L|S|C|A|Q)$/i);
        if (sufMatch) {
            suffix = sufMatch[0];
            right = right.slice(0, -suffix.length);
        }

        const parts = right.split(":").filter(Boolean);
        const trimmed = parts.slice(0, n).join(":");

        // Keep suffix only if we kept the original last field
        const keepSuffix = suffix && n >= parts.length ? suffix : "";

        return left + trimmed + keepSuffix;
    }

    static toNetMHC = (allele: string) => UtilitiesService.trimMHCAllele(allele, 2);
    static toImgtn = (allele: string) => UtilitiesService.trimMHCAllele(allele, 4);

    static setToTextFile(items: Set<string>, filename = 'items.txt'): File {
        const text = Array.from(items).join('\n') + '\n';
        return new File([text], filename, {
            type: 'text/plain; charset=utf-8'
        });
    }

    static setToString(set: Set<any>): string {
        return Array.from(set).join(', ');
    }

    /**
     * Creates a CSV from an array of arrays using PapaParse.
     * Produces UTF-8 with BOM and CRLF line endings (Excel-friendly).
     */
    static buildCsvFromArrays(
        papa: Papa,
        rows: (string | number)[][],
        opts?: Partial<UnparseConfig> & { filename?: string }
    ): {
        csv: string;
        blob: Blob;
        file: File;
        filename: string;
    } {
        const {
            filename = 'data.csv',
            delimiter = ',',
            quotes = true,          // quote all fields to be safe for upload systems
            quoteChar = '"',
            escapeChar = '"',
            skipEmptyLines = true,
            header,                 // ignored for array-of-arrays (no headers)
            ...rest
        } = opts || {};

        // 1) Build raw CSV text
        const csvBody = papa.unparse(rows, {
            delimiter,
            quotes,
            quoteChar,
            escapeChar,
            skipEmptyLines,
            header: header as any, // harmless even if present; AoA ignores header
            ...rest
        });

        // 2) Prepend BOM so Excel and some portals detect UTF-8 correctly
        const BOM = '\uFEFF';
        const csvWithBom = BOM + csvBody;

        // 3) Create uploadable Blob and File
        const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
        const file = new File([blob], filename, { type: blob.type });

        return { csv: csvWithBom, blob, file, filename };
    }

    /**
     * Type mapper mainly used to convert shairr models to AIRR models
     *
     * Usage example:
     *
     * export const mapSubject = createAutoMapper<SubjectModel, AirrSubjectModel>({
     *  transforms: {
     *      // exception: string -> string[]
     *      mhc_genotype_list: s => splitList(s.mhc_genotype_list),
     *      // examples of more exceptions if you ever want them:
     *      // linked_subjects: s => [String(s.id)],
     *      // link_type:      _ => "derives_from",
     *  },
     *  defaults: {
     *      // required on target but not on source
     *      immunogen: "",
     *      sex: "",
     *  },
     *  // Optional: if you want the runtime object to contain ONLY Target keys,
     *  // pass the keys and enable stripUnknown.
     *  // stripUnknown: true,
     *  // targetKeys: [
     *  //   "subject_id","synthetic","species","immunogen","sex","age_min","age_max",
     *  //   "age_unit","age_event","ancestry_population","genotype","diagnosis",
     *  //   "ethnicity","race","strain_name","linked_subjects","link_type","mhc_genotype_list"
     *  // ] as const,
     *  });
     *
     */
    static createAutoMapper<S extends object, T extends object>(opts: {
        transforms?: Transforms<S, T>;
        defaults?: Partial<T>;
        stripUnknown?: boolean;
        targetKeys?: readonly (keyof T)[];
    }) {
        const transforms = opts.transforms ?? {};
        const defaults = opts.defaults ?? {};
        const allow = opts.stripUnknown && opts.targetKeys
            ? new Set<string>(opts.targetKeys as readonly string[])
            : null;

        const transformKeys = new Set<string>(Object.keys(transforms));

        return (src: S): T => {
            const out: any = { ...defaults };

            // copy all same-named source keys unless a transform overrides
            for (const k in src) {
                if (!transformKeys.has(k)) {
                    if (!allow || allow.has(k)) out[k] = (src as any)[k];
                }
            }

            // apply transforms (computed / renamed / overridden)
            for (const k in transforms) {
                const val = (transforms as any)[k](src);
                if (!allow || allow.has(k)) out[k] = val;
            }

            return out as T;
        };
    }

    /**
     * Groups numeric values into fixed-width bins for histogram plotting.
     *
     * @param {number[]} values - The numeric data to be binned.
     * @param {number} binSize - The width of each bin (must be > 0).
     * @returns {{ bins: number[], frequencies: number[] }}
     *   bins: the starting value of each computed bin (sorted ascending)
     *   frequencies: number of values that fall into each corresponding bin
     *
     * Each value is assigned to a bin using:
     *   Math.floor(value / binSize) * binSize
     * The method guarantees that frequencies never contain undefined entries.
     */

    static binValues(values: number[], binSize: number) {
        const bins = new Map<number, number>();

        for (const v of values) {
            if (!Number.isFinite(v)) continue;

            const bin = Math.floor(v / binSize) * binSize;
            bins.set(bin, (bins.get(bin) ?? 0) + 1);
        }

        const sortedBins = [...bins.keys()].sort((a, b) => a - b);
        const frequencies = sortedBins.map(bin => bins.get(bin) ?? 0);

        return { bins: sortedBins, frequencies };
    }
}

export class QueryParamUtils {
    /**
     * Reads a query param and converts it to a finite number.
     * Returns undefined if:
     * - param is missing (null)
     * - param is an empty string
     * - value is not a finite number (NaN, Infinity)
     */
    static toNumber(query: ParamMap, key: string): number | undefined {
        const value = query.get(key);
        if (value == null || value === '') return undefined;

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    /**
     * Reads all values for a query param and converts them to finite numbers.
     * Invalid numbers are filtered out.
     * Returns undefined if no valid numbers remain.
     */
    static toNumberArray(query: ParamMap, key: string): number[] | undefined {
        const parsedValues = query
            .getAll(key)
            .map(value => Number(value))
            .filter(value => Number.isFinite(value));

        return parsedValues.length ? parsedValues : undefined;
    }
}