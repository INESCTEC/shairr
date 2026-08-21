import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DefaultModalService, DefaultModalConfig } from '../../../../services/default-modal.service';
import { ButtonModule, ModalModule } from '@coreui/angular';

@Component({
    selector: 'app-default-modal',
    standalone: true,
    imports: [CommonModule, ModalModule, ButtonModule],
    templateUrl: './default-modal.component.html',
    styleUrls: ['./default-modal.component.scss']
})
export class DefaultModalComponent {
    config$ = this.modalService.config;
    visible$ = this.modalService.visible;

    constructor(public modalService: DefaultModalService) {}

    onVisibleChange(visible: boolean): void {
        if (!visible) {
            this.modalService.close(false);
        }
    }

    onConfirm(): void {
        this.modalService.close(true);
    }

    onCancel(): void {
        this.modalService.close(false);
    }

    getType(config: DefaultModalConfig | null): string {
        if (!config) return 'info';
        if (config.message?.toLowerCase().includes('delete')) {
            return 'danger';
        }
        if (config.type === 'confirm') {
            return 'warning';
        }
        return 'info';
    }

    getGradient(config: DefaultModalConfig | null): string {
        const type = this.getType(config);
        const colors = {
            danger: '#f5c6cb',
            warning: '#ffeaa1',
            info: '#b8d5f0'
        };
        const color = colors[type as keyof typeof colors] || '#b8d5f0';
        return `linear-gradient(to bottom, ${color} 0%, white 100%)`;
    }

    getBorderColor(config: DefaultModalConfig | null): string {
        const type = this.getType(config);
        const colors = {
            danger: '#dc3545',
            warning: '#ffc107',
            info: '#2356a2'
        };
        return colors[type as keyof typeof colors] || '#2356a2';
    }

    getTitleColor(config: DefaultModalConfig | null): string {
        return this.getBorderColor(config);
    }

    getIconClass(config: DefaultModalConfig | null): string {
        const type = this.getType(config);
        if (type === 'danger') return 'fa fa-trash';
        if (type === 'warning') return 'fa fa-exclamation-triangle';
        return 'fa fa-info-circle';
    }
}