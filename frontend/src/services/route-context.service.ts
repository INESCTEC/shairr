import { Injectable } from '@angular/core';

interface RouteContext {
    pipelineId?: string;
    repositoryId?: string;
    study_id?: string;
    subject_id?: string;
    sample_id?: string;
    [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class RouteContextService {
    private context: RouteContext = {};

    set(key: keyof RouteContext, value: any) {
        this.context[key] = value;
        localStorage.setItem(`routeContext_${key}`, JSON.stringify(value));
    }

    get<T = any>(key: keyof RouteContext): T | undefined {
        const memoryValue = this.context[key];
        if (memoryValue !== undefined) return memoryValue;

        const storedValue = localStorage.getItem(`routeContext_${key}`);
        if (storedValue) {
            const parsed = JSON.parse(storedValue);
            this.context[key] = parsed;
            return parsed;
        }

        return undefined;
    }

    clear(key?: keyof RouteContext) {
        if (key) {
            delete this.context[key];
            localStorage.removeItem(`routeContext_${key}`);
        } else {
            this.context = {};
            Object.keys(localStorage)
                .filter(k => k.startsWith('routeContext_'))
                .forEach(k => localStorage.removeItem(k));
        }
    }
}
