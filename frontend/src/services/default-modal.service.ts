import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface DefaultModalConfig {
    title: string;
    message: string;
    type: 'confirm' | 'alert';
    confirmText?: string;
    cancelText?: string;
}

@Injectable({
    providedIn: 'root'
})
export class DefaultModalService {
    private modalConfig$ = new BehaviorSubject<DefaultModalConfig | null>(null);
    private modalVisible$ = new BehaviorSubject<boolean>(false);
    private resolveFn: ((value: boolean) => void) | null = null;

    public config = this.modalConfig$.asObservable();
    public visible = this.modalVisible$.asObservable();

    constructor() {}

    confirm(config: DefaultModalConfig): Promise<boolean> {
        const modalConfig: DefaultModalConfig = {
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            ...config
        };
        modalConfig.type = 'confirm';
        this.modalConfig$.next(modalConfig);
        this.modalVisible$.next(true);

        return new Promise((resolve) => {
            this.resolveFn = resolve;
        });
    }

    alert(config: DefaultModalConfig): Promise<boolean> {
        const modalConfig: DefaultModalConfig = {
            confirmText: 'OK',
            ...config
        };
        modalConfig.type = 'alert';
        this.modalConfig$.next(modalConfig);
        this.modalVisible$.next(true);

        return new Promise((resolve) => {
            this.resolveFn = resolve;
        });
    }

    close(result: boolean = false): void {
        if (this.resolveFn) {
            this.resolveFn(result);
            this.resolveFn = null;
        }
        this.modalVisible$.next(false);
        this.modalConfig$.next(null);
    }
}