import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export enum ToastType {
    WARNING = 'WARNING',
    ERROR = 'ERROR',
    INFO = 'INFO',
    SUCCESS = 'SUCCESS'
}

export interface Toast {
    id: number;
    title: string;
    message: string;
    type: ToastType;
    timestamp: Date;
    autohide?: boolean;
    delay?: number;
}

@Injectable({
    providedIn: 'root',
})
export class ToastService {
    public visible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    public title$: BehaviorSubject<string> = new BehaviorSubject<string>("Message");
    public message$: BehaviorSubject<string> = new BehaviorSubject<string>("");
    public percentage$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
    
    private toastIdCounter = 0;
    public toasts$: BehaviorSubject<Toast[]> = new BehaviorSubject<Toast[]>([]);

    constructor() {}

    async displayMessage(message: string, type: ToastType = ToastType.INFO): Promise<void> {

        var notification = {
            message: message,
            title: this.getDefaultTitle(type),
            level: type,
            timestamp: new Date(),
            location: window.location.href
        }
        
        this.message$.next(message);
        this.visible$.next(true);
        
        const toast: Toast = {
            id: this.toastIdCounter++,
            title: this.getDefaultTitle(type),
            message: message,
            type: type,
            timestamp: new Date(),
            autohide: type !== ToastType.ERROR,
            delay: 5000
        };
        
        const currentToasts = this.toasts$.value;
        this.toasts$.next([...currentToasts, toast]);
    }

    info(message: string): void {
        this.displayMessage(message, ToastType.INFO);
    }

    success(message: string): void {
        this.displayMessage(message, ToastType.SUCCESS);
    }

    warning(message: string): void {
        this.displayMessage(message, ToastType.WARNING);
    }

    error(message: string): void {
        this.displayMessage(message, ToastType.ERROR);
    }

    dismissToast(): void {
        this.visible$.next(false);
    }

    onVisibleChange($event: boolean) {
        this.visible$.next($event);
        this.percentage$.next(!this.visible$.value ? 0 : this.percentage$.value);
    }

    onTimerChange($event: number) {
        this.percentage$.next($event * 25);
    }

    removeToast(toastId: number): void {
        const currentToasts = this.toasts$.value;
        this.toasts$.next(currentToasts.filter(t => t.id !== toastId));
    }

    clearAllToasts(): void {
        this.toasts$.next([]);
    }

    private getDefaultTitle(type: ToastType): string {
        switch(type) {
            case ToastType.SUCCESS: return 'Success';
            case ToastType.ERROR: return 'Error';
            case ToastType.WARNING: return 'Warning';
            case ToastType.INFO: return 'Information';
            default: return 'Message';
        }
    }
}