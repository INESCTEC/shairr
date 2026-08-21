import { Component, Input, OnInit } from '@angular/core';
import { DefaultModalService } from 'src/services/default-modal.service';
import { ToastType, ToastService, } from 'src/services/toast.service';

@Component({
    selector: 'app-widgets-toast',
    templateUrl: './widgets-toast.component.html',
    styleUrls: ['./widgets-toast.component.scss']
})
export class WidgetsToastComponent implements OnInit {
    @Input() title: string = 'Message';
    @Input() message: string = '';

    visible: boolean = false;
    position = 'bottom-end';
    percentage = 0;

    constructor(public toaster: ToastService) { }

    ngOnInit(): void { }

    getToastColor(type: ToastType): string {
        switch (type) {
            case ToastType.SUCCESS: return '#28a745';
            case ToastType.ERROR: return '#dc3545';
            case ToastType.WARNING: return '#ffc107';
            case ToastType.INFO: return '#2356a2';
            default: return '#2356a2';
        }
    }

    getToastGradient(type: ToastType): string {
        const color = this.getToastBackgroundColor(type);
        return `linear-gradient(to bottom, ${color} 0%, white 100%)`;
    }

    getToastBackgroundColor(type: ToastType): string {
        switch (type) {
            case ToastType.SUCCESS: return '#c3e6cb';
            case ToastType.ERROR: return '#f5c6cb';
            case ToastType.WARNING: return '#ffeaa1';
            case ToastType.INFO: return '#b8d5f0';
            default: return '#b8d5f0';
        }
    }

    getToastIcon(type: ToastType): string {
        switch (type) {
            case ToastType.SUCCESS: return 'fa-check';
            case ToastType.ERROR: return 'fa-exclamation-triangle';
            case ToastType.WARNING: return 'fa-exclamation-circle';
            case ToastType.INFO: return 'fa-info-circle';
            default: return 'fa-info-circle';
        }
    }
}