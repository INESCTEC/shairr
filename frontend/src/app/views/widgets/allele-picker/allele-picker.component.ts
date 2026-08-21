import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    Output,
    QueryList,
    ViewChildren,
    ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IDropdownSettings } from 'ng-multiselect-dropdown';
import { ListItem } from 'node_modules/ng-multiselect-dropdown/multiselect.model';
import { AlleleModel, EbiResponseModel } from 'src/models/ebi/alleles.model';
import { GenotypeModel } from 'src/models/shairr/datasources/genotype.model';
import { EBIService } from 'src/services/ebi.service';
import { ToastService, ToastType } from 'src/services/toast.service';
import { UtilitiesService } from 'src/services/utilities.service';

export class AlleleElement {
    name: string = '';
    mhc_class: string = '';
}

@Component({
    selector: 'app-allele-picker',
    templateUrl: './allele-picker.component.html',
    styleUrl: './allele-picker.component.scss',
    encapsulation: ViewEncapsulation.None,
})
export class AllelePickerComponent implements AfterViewInit {
    @Input() set organismGroup(value: string | undefined) {
        console.log('AllelePicker received organismGroup:', value); // Add debug

        if (value && value !== this.selectedOrganismGroup) {
            this.selectedOrganismGroup = value;
            this.loadAlleles();
        } else if (value && !this.selectedOrganismGroup) {
            this.selectedOrganismGroup = value;
            this.loadAlleles();
        }
    }

    refreshAlleles(organismGroup: string) {
        console.log('Refreshing alleles with organism group:', organismGroup);
        if (organismGroup) {
            this.selectedOrganismGroup = organismGroup;
            this.loadAlleles();
        }
    }

    @Input() disabled: boolean = false;

    selectedAlleles: AlleleElement[] = [];
    subjectId: number = 0;

    @Input() set alleles(value: AlleleElement[]) {
        if (value) {
            this.selectedAlleles = value;
            this.filteredSelectedAlleles = value;
        }
    }

    @Output() speciesChange = new EventEmitter<ListItem[]>();
    @Output() alleleChange = new EventEmitter<AlleleElement>();
    @Output() classChange = new EventEmitter<string>();
    @Output() alleleRemove = new EventEmitter<AlleleElement>();
    @Output() manualAlleleAdd = new EventEmitter<GenotypeModel>();

    @ViewChildren('alleleCheckbox') checkboxes!: QueryList<ElementRef>;

    private project: 'HLA' | 'MHC' = 'HLA';

    selectedOrganismGroup?: string;
    selectedClass: string = 'I';
    filteredSelectedAlleles: AlleleElement[] = [];

    allelesLoading: boolean = false;

    alleleOptions: AlleleModel[] = [];
    filteredAlleles: AlleleModel[] = [];

    organismGroups = this.ebiService.getSupportedOrganisms();
    width: any;
    manual: boolean = true;

    manualAlleleName: string = '';
    manualAlleleMhcClass: string = 'I';

    alleleSearchQuery: string = '';
    selectedAlleleSearchQuery: string = '';

    dropdownSettings: IDropdownSettings = {
        singleSelection: false,
        idField: 'id',
        textField: 'id',
        itemsShowLimit: 6,
        allowSearchFilter: true,
        noDataAvailablePlaceholderText: 'Loading allele data...',
    };

    constructor(
        private ebiService: EBIService,
        private toast: ToastService,
        private activatedRoute: ActivatedRoute,
    ) { }

    ngAfterViewInit() {
    }

    isInWorkspaces() {
        return this.activatedRoute.snapshot.url.toString().includes('workspace');
    }

    alleleCreator() {
        if (this.manualAlleleName == '' || this.manualAlleleMhcClass == '') {
            this.toast.displayMessage(
                'Please enter both name and MHC class for the manual allele.',
                ToastType.INFO,
            );
            return;
        }

        const alleleExists = this.selectedAlleles.some(
            (allele) =>
                allele.name === this.manualAlleleName &&
                allele.mhc_class === this.manualAlleleMhcClass,
        );

        if (alleleExists) {
            return;
        }

        const newAllele: AlleleElement = {
            name: this.manualAlleleName,
            mhc_class: this.manualAlleleMhcClass,
        };

        this.selectedAlleles.push(newAllele);
        this.filteredSelectedAlleles = [...this.selectedAlleles];


        this.alleleChange.emit(newAllele);
        this.manualAlleleAdd.emit({
            name: this.manualAlleleName,
            mhc_class: this.manualAlleleMhcClass,
        } as GenotypeModel);

        this.manualAlleleName = '';
        this.manualAlleleMhcClass = 'I';

        this.toast.displayMessage(
            `Successfully added manual allele: ${newAllele.name}`,
            ToastType.SUCCESS,
        );
    }

    ngAfterContentInit() {
        if (
            window.location.href.includes('edit') ||
            window.location.href.includes('create')
        ) {
            this.width = window.innerWidth;
        } else {
            this.width = 799;
        }
    }

    paginationPrevious?: string;
    paginationNext?: string;

    loadAlleles(pagination?: string) {
        if (!this.selectedOrganismGroup) {
            this.toast.displayMessage(
                "Couldn't load alleles. Organism Group was not defined.",
            );
            return;
        }

        this.allelesLoading = true;
        let filterOrganismGroup = undefined;

        if (this.selectedOrganismGroup === 'HLA') {
            this.project = 'HLA';
        } else {
            this.project = 'MHC';
            filterOrganismGroup = this.selectedOrganismGroup;
        }

        this.ebiService
            .getAlleles(
                this.project,
                pagination == 'prev' ? this.paginationPrevious : undefined,
                pagination == 'next' ? this.paginationNext : undefined,
                this.selectedClass,
                filterOrganismGroup,
            )
            .then((ebiResponse: any) => {
                this.formatAlleleResponse(ebiResponse);
                this.paginationNext = ebiResponse.meta.next;
                this.paginationPrevious = ebiResponse.meta.prev;
                this.removeSelectedAlleles();
            })
            .catch((e) => {
                this.toast.displayMessage(
                    "Connection error while acquiring MHC/HLA alleles. Check the browser's console for more details",
                );
                console.error(e);
            })
            .finally(() => {
                this.allelesLoading = false;
            });
    }

    removeSelectedAlleles() {
        const selectedNames = new Set(this.selectedAlleles.map((a) => a.name));
        this.alleleOptions = this.alleleOptions.filter(
            (allele) => !selectedNames.has(allele.name),
        );
        this.filterAllelesByQuery();
    }

    onScroll(event: Event): void {
        const element = event.target as HTMLElement;
        const scrollTop = element.scrollTop;
        const scrollHeight = element.scrollHeight;
        const clientHeight = element.clientHeight;

        const tolerance = 2;
        const atBottom =
            Math.abs(scrollHeight - scrollTop - clientHeight) <= tolerance;
        const atTop = scrollTop <= tolerance;

        if (atBottom) {
            this.loadAlleles('next');
        }

        if (atTop && this.paginationPrevious) {
            this.loadAlleles('prev');
        }
    }

    private formatAllele = (mhc: any): any => {
        const alleleClass = mhc.accession.match(/^[a-zA-Z]+/);
        mhc.accession = alleleClass ? alleleClass[0] : mhc.accession;
        mhc.id = alleleClass + '-' + mhc.name;
        mhc.species = this.selectedOrganismGroup;
        mhc.class = this.selectedClass;
        return mhc;
    };

    private formatAlleleResponse(ebiResponse: EbiResponseModel) {
        const shouldClearData = (): boolean => {
            if (this.alleleOptions.length === 0) {
                return false;
            }

            const existingOrganismGroup = this.alleleOptions[0]?.species;
            const existingClass = this.alleleOptions[0]?.class;
            const newOrganismGroup = ebiResponse.data[0]?.species;
            const newClass = ebiResponse.data[0]?.class;

            return (
                existingOrganismGroup !== newOrganismGroup ||
                existingClass !== newClass
            );
        };

        if (shouldClearData()) {
            this.alleleOptions = [];
            this.filteredAlleles = [];
            this.alleleSearchQuery = '';
        }

        if (this.alleleOptions.length === 0) {
            this.alleleOptions = ebiResponse.data.map((mhc) =>
                this.formatAllele(mhc),
            );
        } else {
            const existingAlleleNames = new Set(
                this.alleleOptions.map((allele) => allele.name),
            );

            const newAlleles = ebiResponse.data
                .map((mhc) => this.formatAllele(mhc))
                .filter((allele) => !existingAlleleNames.has(allele.name));

            this.alleleOptions = [...this.alleleOptions, ...newAlleles];
        }

        this.filterAllelesByQuery();
    }

    onOrganismGroupChange() {
        this.loadAlleles();
        this.speciesChange.emit();
    }

    filterSelectedAllelesByQuery() {
        this.filteredSelectedAlleles = this.selectedAlleles.filter((a) =>
            a.name.includes(this.selectedAlleleSearchQuery)
        );
    }

    filterAllelesByQuery() {
        this.filteredAlleles = this.alleleOptions.filter((a) =>
            a.name.includes(this.alleleSearchQuery)
        );
    }

    onAlleleSearch(query: string) {
        this.alleleSearchQuery = query;
        this.filterAllelesByQuery();
    }

    onSelectedAlleleSearch(query: string) {
        this.selectedAlleleSearchQuery = query;
        this.filterSelectedAllelesByQuery();
    }

    selectAlleles() {
        if (!this.checkboxes) {
            console.warn('Checkboxes not yet initialized');
            return;
        }

        let addedCount = 0;
        let repeatedCount = 0;
        const checkboxesToProcess = this.checkboxes.toArray();

        for (const checkboxRef of checkboxesToProcess) {
            const nativeElement = checkboxRef.nativeElement as HTMLInputElement;

            if (nativeElement.checked) {
                const value = nativeElement.value;

                if (!value) continue;

                const alreadySelected = this.selectedAlleles.some(
                    (allele) => allele.name === value,
                );

                if (alreadySelected) {
                    repeatedCount++;
                } else {
                    const newAllele: AlleleElement = {
                        name: value,
                        mhc_class: this.selectedClass,
                    };

                    this.alleleChange.emit(newAllele);
                    this.filterSelectedAllelesByQuery();
                    addedCount++;
                }

                nativeElement.checked = false;
            }
        }

        if (repeatedCount > 0) {
            this.toast.displayMessage(
                `${repeatedCount} allele(s) were already selected and were ignored.`,
                ToastType.INFO,
            );
        }

        if (addedCount === 0 && repeatedCount === 0) {
            const checkedCount = this.checkboxes?.filter(
                (cb) => cb.nativeElement.checked,
            ).length;
            if (checkedCount && checkedCount > 0) {
                this.toast.displayMessage(
                    'No valid alleles were selected to add.',
                    ToastType.WARNING,
                );
            } else {
                this.toast.displayMessage(
                    'Please select at least one allele to add.',
                    ToastType.WARNING,
                );
            }
        }
    }

    clearAlleles() {
        if (this.selectedAlleles.length === 0) {
            this.toast.displayMessage('No alleles to clear.', ToastType.INFO);
            return;
        }

        const count = this.selectedAlleles.length;
        for (let i = this.selectedAlleles.length - 1; i >= 0; i--) {
            this.removeAllele(this.selectedAlleles[i]);
        }

        this.toast.displayMessage(
            `Cleared ${count} allele(s).`,
            ToastType.SUCCESS,
        );
    }

    getColor(name: string) {
        return UtilitiesService.generateMHCBadgeColor(name);
    }

    removeAllele(allele: AlleleElement) {
        const index = this.selectedAlleles.findIndex(
            (s) => s.name === allele.name,
        );


        if (index !== -1) {
            this.filterSelectedAllelesByQuery();
            this.alleleRemove.emit(allele);

            if (window.location.href.includes('workspace')) {
                this.selectedAlleles.splice(index, 1);
            }
        }
    }
}
