import { Component, EventEmitter, Output } from '@angular/core';
import { DefaultModalService } from 'src/services/default-modal.service';

@Component({
    selector: 'app-button-download',
    templateUrl: './button-download.component.html',
    styleUrls: ['./button-download.component.scss']
})
export class ButtonDownloadComponent {
    @Output() action: EventEmitter<any> = new EventEmitter();

    downloading: boolean = false;

    onDownloadClick() {
        this.downloading = true;
        this.action.emit();
    }
}
