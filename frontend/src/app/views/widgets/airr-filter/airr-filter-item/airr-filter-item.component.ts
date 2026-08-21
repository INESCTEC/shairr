import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DefaultModalService } from 'src/services/default-modal.service';
import { AirrField } from 'src/models/airr/airr-field.model';


@Component({
    selector: 'app-airr-filter-item',
    templateUrl: './airr-filter-item.component.html',
    styleUrl: './airr-filter-item.component.scss'
})
export class AirrFilterItemComponent {
    @Input('field') airrField!: AirrField;
    @Output() filtered = new EventEmitter<AirrField>();

    onApply() {
        this.filtered.emit(this.airrField)
    }
}
