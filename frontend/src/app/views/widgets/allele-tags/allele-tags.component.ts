import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DefaultModalService } from 'src/services/default-modal.service';
import { UtilitiesService } from 'src/services/utilities.service';

@Component({
    selector: 'app-allele-tags',
    templateUrl: './allele-tags.component.html',
    styleUrl: './allele-tags.component.scss'
})
export class AlleleTagsComponent {
    @Input() alleles: string[] = []
    @Input() readOnly: boolean = true;
    @Input() horizontal: boolean = false;

    @Output() removeAllele = new EventEmitter<string>();

    public onRemoveAllele(allele: string) {
        if (!this.readOnly) {
            this.alleles = this.alleles.filter(a => a !== allele);
            this.removeAllele.emit(allele);
        }
    }

    public generateMHCBadgeColor = UtilitiesService.generateMHCBadgeColor;


}
