import { AbstractControl, FormControl, FormGroup } from '@angular/forms';

type AnyObject = Record<string, unknown>;

interface LoadOptions {
    /** If true, creates missing controls (FormControl / FormGroup) on the fly */
    createMissing?: boolean;
    /** If true, uses patchValue semantics for FormGroups when possible */
    patchGroups?: boolean;
}

/**
 * Loads a plain object into a FormGroup by iterating keys recursively.
 * - Only sets values for controls that exist (unless createMissing is true).
 * - Recurses into nested objects when the target control is a FormGroup.
 */
export function loadIntoFormGroup(
    form: FormGroup,
    data: AnyObject,
    options: LoadOptions = { createMissing: false, patchGroups: false }
): void {
    if (!data || typeof data !== 'object') return;

    for (const [key, value] of Object.entries(data)) {
        const ctrl = form.get(key);

        if (!ctrl) {
            if (options.createMissing) {
                if (isPlainObject(value)) {
                    const fg = new FormGroup({});
                    form.addControl(key, fg);
                    loadIntoFormGroup(fg, value as AnyObject, options);
                } else {
                    form.addControl(key, new FormControl(value));
                }
            }
            continue;
        }

        applyValue(ctrl, value, options);
    }
}

function applyValue(ctrl: AbstractControl, value: unknown, options: LoadOptions): void {
    if (ctrl instanceof FormGroup && isPlainObject(value)) {
        if (options.patchGroups) {
            ctrl.patchValue(value as AnyObject, { emitEvent: false });
        }
        loadIntoFormGroup(ctrl, value as AnyObject, options);
        return;
    }

    ctrl.setValue(value, { emitEvent: false });
}

function isPlainObject(v: unknown): v is AnyObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
