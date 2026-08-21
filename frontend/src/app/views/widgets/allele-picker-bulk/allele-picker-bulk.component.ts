import {
    Component,
    ElementRef,
    EventEmitter,
    Input,
    Output,
    QueryList,
    ViewChildren,
    ViewEncapsulation,
    OnInit,
    OnDestroy,
} from '@angular/core';
import { OntologyModel } from 'src/models/airr/ontology.model';
import { AlleleModel, EbiResponseModel } from 'src/models/ebi/alleles.model';
import { EBIService } from 'src/services/ebi.service';
import { ToastService, ToastType } from 'src/services/toast.service';
import { UtilitiesService } from 'src/services/utilities.service';

export interface SubjectAlleleInfo {
    subjectId: number;
    subjectName: string;
    hasAllele: boolean;
}

export interface ClusteredAllele {
    name: string;
    mhc_class: string;
    subjects: SubjectAlleleInfo[];
    totalSubjects: number;
    selectedCount: number;
    showExpanded: boolean;
}

@Component({
    selector: 'app-allele-picker-bulk',
    templateUrl: './allele-picker-bulk.component.html',
    styleUrls: ['./allele-picker-bulk.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class AllelePickerBulkComponent implements OnInit, OnDestroy {
    organismGroupFilter: string[] = [];
    @Input() studyId?: number;
    @Input()
    set filterSpecies(value: Array<string>) {
        this.organismGroupFilter = value;
    }

    private _subjects: Array<{ id: number; name: string }> = [];

    @Input()
    set subjects(value: Array<{ id: number; name: string }>) {
        this._subjects = value;
        if (value && value.length > 0 && this._currentSubjectAlleles) {
            this.buildClusteredAlleles();
        }
    }

    get subjects() {
        return this._subjects;
    }

    private _currentSubjectAlleles?: Map<
        number,
        Array<{ name: string; mhc_class: string }>
    >;

    @Input()
    set currentSubjectAlleles(
        value:
            | Map<number, Array<{ name: string; mhc_class: string }>>
            | undefined,
    ) {
        this._currentSubjectAlleles = value;
        if (value && this._subjects.length > 0) {
            this.buildClusteredAlleles();
        }
    }

    getFilteredOrganismGroups() {
        // If no filter, return all
        if (
            !this.organismGroupFilter ||
            this.organismGroupFilter.length === 0
        ) {
            return this.organismGroups;
        }

        const filtered: any = {};
        Object.keys(this.organismGroups).forEach((key) => {
            if (this.organismGroupFilter.includes(key)) {
                filtered[key] = this.organismGroups[key];
            }
        });
        return filtered;
    }

    get currentSubjectAlleles() {
        return this._currentSubjectAlleles;
    }

    @Output() addAlleleToSubjects = new EventEmitter<{
        alleleName: string;
        alleleClass: string;
        subjectIds: number[];
    }>();
    @Output() removeAlleleFromSubjects = new EventEmitter<{
        alleleName: string;
        alleleClass: string;
        subjectIds: number[];
    }>();
    @Output() clearAllAlleles = new EventEmitter<{
        studyId: number;
        subjectIds: number[];
    }>();
    @Output() close = new EventEmitter<void>();

    selectedClass: string = 'I';
    selectedOrganismGroup?: string;
    allelesLoading: boolean = false;

    alleleOptions: AlleleModel[] = [];
    filteredAlleles: AlleleModel[] = [];
    clusteredAlleles: ClusteredAllele[] = [];
    filteredClusteredAlleles: ClusteredAllele[] = [];

    alleleSearchQuery: string = '';
    clusteredSearchQuery: string = '';

    paginationPrevious?: string;
    paginationNext?: string;

    manualAlleleName: string = '';
    manualAlleleMhcClass: string = 'I';
    manual: boolean = true;

    width: number = 800;
    disabled: boolean = false;
    selectedAlleleSearchQuery: string = '';

    @ViewChildren('alleleCheckbox') checkboxes!: QueryList<ElementRef>;
    organismGroups: any;

    get selectedAlleles() {
        return this.clusteredAlleles.map((allele) => ({
            name: allele.name,
            mhc_class: allele.mhc_class,
        }));
    }

    get filteredSelectedAlleles() {
        if (!this.selectedAlleleSearchQuery.trim()) {
            return this.selectedAlleles;
        }
        const query = this.selectedAlleleSearchQuery.toLowerCase();
        return this.selectedAlleles.filter((allele) =>
            allele.name.toLowerCase().includes(query),
        );
    }

    getAlleleCount(alleleName: string): number {
        let count = 0;
        for (const subject of this._subjects) {
            const alleles = this._currentSubjectAlleles?.get(subject.id);
            if (alleles && alleles.some((a) => a.name === alleleName)) {
                count++;
            }
        }
        return count;
    }

    get totalSubjectsCount(): number {
        return this._subjects.length;
    }

    constructor(
        private ebiService: EBIService,
        private toast: ToastService,
    ) {
        this.organismGroups = this.ebiService.getSupportedOrganisms();
    }

    ngOnInit() {
        this.selectedOrganismGroup = this.organismGroups[0];
        this.width = window.innerWidth;
        if (this.selectedOrganismGroup) {
            this.loadAlleles();
        }
        this.buildClusteredAlleles();
    }

    ngOnDestroy() {}

    buildClusteredAlleles() {
        if (!this._currentSubjectAlleles || this._subjects.length === 0) {
            this.clusteredAlleles = [];
            this.filteredClusteredAlleles = [];
            return;
        }

        const alleleMap = new Map<string, ClusteredAllele>();
        const totalSubjects = this._subjects.length;
        const allSubjectInfos: SubjectAlleleInfo[] = this._subjects.map(
            (s) => ({
                subjectId: s.id,
                subjectName: s.name,
                hasAllele: false,
            }),
        );

        for (const [
            subjectId,
            alleles,
        ] of this._currentSubjectAlleles.entries()) {
            for (const allele of alleles) {
                const key = `${allele.name}_${allele.mhc_class}`;

                if (!alleleMap.has(key)) {
                    const subjectInfos = allSubjectInfos.map((info) => ({
                        ...info,
                        hasAllele: false,
                    }));

                    alleleMap.set(key, {
                        name: allele.name,
                        mhc_class: allele.mhc_class,
                        subjects: subjectInfos,
                        totalSubjects: totalSubjects,
                        selectedCount: 0,
                        showExpanded: false,
                    });
                }

                const clustered = alleleMap.get(key)!;
                const subjectIndex = clustered.subjects.findIndex(
                    (s) => s.subjectId === subjectId,
                );
                if (
                    subjectIndex !== -1 &&
                    !clustered.subjects[subjectIndex].hasAllele
                ) {
                    clustered.subjects[subjectIndex].hasAllele = true;
                    clustered.selectedCount++;
                }
            }
        }

        this.clusteredAlleles = Array.from(alleleMap.values());
        this.filterClusteredAlleles();
    }

    filterClusteredAlleles() {
        if (!this.clusteredSearchQuery.trim()) {
            this.filteredClusteredAlleles = [...this.clusteredAlleles];
        } else {
            const query = this.clusteredSearchQuery.toLowerCase();
            this.filteredClusteredAlleles = this.clusteredAlleles.filter(
                (allele) => allele.name.toLowerCase().includes(query),
            );
        }
    }

    onClusteredSearch(query: string) {
        this.clusteredSearchQuery = query;
        this.filterClusteredAlleles();
    }

    onSelectedAlleleSearch(query: string) {
        this.selectedAlleleSearchQuery = query;
    }

    toggleExpandAllele(allele: ClusteredAllele) {
        allele.showExpanded = !allele.showExpanded;
    }

    addAlleleToMissingSubjects(allele: ClusteredAllele) {
        const missingSubjectIds = allele.subjects
            .filter((s) => !s.hasAllele)
            .map((s) => s.subjectId);

        if (missingSubjectIds.length === 0) {
            this.toast.displayMessage(
                `Allele ${allele.name} is already present in all subjects.`,
                ToastType.INFO,
            );
            return;
        }

        this.addAlleleToSubjects.emit({
            alleleName: allele.name,
            alleleClass: allele.mhc_class,
            subjectIds: missingSubjectIds,
        });

        for (const subjectId of missingSubjectIds) {
            const subjectIndex = allele.subjects.findIndex(
                (s) => s.subjectId === subjectId,
            );
            if (subjectIndex !== -1) {
                allele.subjects[subjectIndex].hasAllele = true;
                allele.selectedCount++;
            }
        }

        this.toast.displayMessage(
            `Added ${allele.name} to ${missingSubjectIds.length} subject(s).`,
            ToastType.SUCCESS,
        );
    }

    testAlert() {
        alert('test');
    }

    addAlleleToAllSubjects(allele: any) {
        const subjectIds = this._subjects.map((s) => s.id);

        const missingSubjectIds = subjectIds.filter((id) => {
            const alleles = this._currentSubjectAlleles?.get(id);
            return !alleles || !alleles.some((a) => a.name === allele.name);
        });

        if (missingSubjectIds.length === 0) {
            this.toast.displayMessage(
                `Allele ${allele.name} is already in all subjects`,
                ToastType.INFO,
            );
            return;
        }

        this.addAlleleToSubjects.emit({
            alleleName: allele.name,
            alleleClass: allele.mhc_class || 'I',
            subjectIds: missingSubjectIds,
        });

        for (const subjectId of missingSubjectIds) {
            if (!this._currentSubjectAlleles) {
                this._currentSubjectAlleles = new Map();
            }
            if (!this._currentSubjectAlleles.get(subjectId)) {
                this._currentSubjectAlleles.set(subjectId, []);
            }
            this._currentSubjectAlleles.get(subjectId)!.push({
                name: allele.name,
                mhc_class: allele.mhc_class || 'I',
            });
        }

        this.buildClusteredAlleles();
        this.toast.displayMessage(
            `Added ${allele.name} to ${missingSubjectIds.length} subject(s)`,
            ToastType.SUCCESS,
        );
    }

    removeAlleleFromSubjectsList(
        allele: ClusteredAllele,
        subjectIds?: number[],
    ) {
        const subjectIdsToRemove =
            subjectIds ||
            allele.subjects.filter((s) => s.hasAllele).map((s) => s.subjectId);

        if (subjectIdsToRemove.length === 0) {
            this.toast.displayMessage(
                `No subjects have allele ${allele.name} to remove.`,
                ToastType.INFO,
            );
            return;
        }

        this.removeAlleleFromSubjects.emit({
            alleleName: allele.name,
            alleleClass: allele.mhc_class,
            subjectIds: subjectIdsToRemove,
        });

        for (const subjectId of subjectIdsToRemove) {
            const subjectIndex = allele.subjects.findIndex(
                (s) => s.subjectId === subjectId,
            );
            if (
                subjectIndex !== -1 &&
                allele.subjects[subjectIndex].hasAllele
            ) {
                allele.subjects[subjectIndex].hasAllele = false;
                allele.selectedCount--;
            }
        }

        this.toast.displayMessage(
            `Removed ${allele.name} from ${subjectIdsToRemove.length} subject(s).`,
            ToastType.SUCCESS,
        );
    }

    selectAlleles() {
        if (!this.checkboxes) {
            console.warn('Checkboxes not yet initialized');
            return;
        }

        const selectedAlleleNames: string[] = [];
        const checkboxesToProcess = this.checkboxes.toArray();

        for (const checkboxRef of checkboxesToProcess) {
            const nativeElement = checkboxRef.nativeElement as HTMLInputElement;
            if (nativeElement.checked) {
                const value = nativeElement.value;
                if (value) {
                    selectedAlleleNames.push(value);
                }
                nativeElement.checked = false;
            }
        }

        if (selectedAlleleNames.length === 0) {
            this.toast.displayMessage(
                'Please select at least one allele to add.',
                ToastType.WARNING,
            );
            return;
        }

        const allSubjectIds = this._subjects.map((s) => s.id);

        for (const alleleName of selectedAlleleNames) {
            const existingAllele = this.clusteredAlleles.find(
                (ca) =>
                    ca.name === alleleName &&
                    ca.mhc_class === this.selectedClass,
            );

            if (existingAllele) {
                const missingSubjectIds = existingAllele.subjects
                    .filter((s) => !s.hasAllele)
                    .map((s) => s.subjectId);

                if (missingSubjectIds.length > 0) {
                    this.addAlleleToSubjects.emit({
                        alleleName: alleleName,
                        alleleClass: this.selectedClass,
                        subjectIds: missingSubjectIds,
                    });

                    for (const subjectId of missingSubjectIds) {
                        const subjectIndex = existingAllele.subjects.findIndex(
                            (s) => s.subjectId === subjectId,
                        );
                        if (subjectIndex !== -1) {
                            existingAllele.subjects[subjectIndex].hasAllele =
                                true;
                            existingAllele.selectedCount++;
                        }
                    }
                }
            } else {
                this.addAlleleToSubjects.emit({
                    alleleName: alleleName,
                    alleleClass: this.selectedClass,
                    subjectIds: allSubjectIds,
                });

                const allSubjectInfos: SubjectAlleleInfo[] = this._subjects.map(
                    (s) => ({
                        subjectId: s.id,
                        subjectName: s.name,
                        hasAllele: true,
                    }),
                );

                this.clusteredAlleles.push({
                    name: alleleName,
                    mhc_class: this.selectedClass,
                    subjects: allSubjectInfos,
                    totalSubjects: this._subjects.length,
                    selectedCount: this._subjects.length,
                    showExpanded: false,
                });
            }
        }

        this.filterClusteredAlleles();
        this.toast.displayMessage(
            `Added ${selectedAlleleNames.length} allele(s) to all subjects.`,
            ToastType.SUCCESS,
        );
    }

    clearAlleles() {
        if (this.clusteredAlleles.length === 0) {
            this.toast.displayMessage('No alleles to clear.', ToastType.INFO);
            return;
        }

        const allSubjectIds = this._subjects.map((s) => s.id);

        this.clearAllAlleles.emit({
            studyId: this.studyId!,
            subjectIds: allSubjectIds,
        });

        this.clusteredAlleles = [];
        this.filteredClusteredAlleles = [];

        this.toast.displayMessage(
            'Cleared all alleles from all subjects.',
            ToastType.SUCCESS,
        );
    }

    alleleCreator() {
        this.addManualAllele();
    }

    isInWorkspaces() {
        return false;
    }

    removeAllele(allele: any) {
        const subjectIds = this._subjects.map((s) => s.id);
        const clusteredAllele: ClusteredAllele = {
            name: allele.name,
            mhc_class: allele.mhc_class || 'I',
            subjects: [],
            totalSubjects: this._subjects.length,
            selectedCount: 0,
            showExpanded: false,
        };
        this.removeAlleleFromSubjectsList(clusteredAllele, subjectIds);
    }

    loadAlleles(pagination?: string) {
        if (!this.selectedOrganismGroup) {
            this.toast.displayMessage(
                "Couldn't load alleles. Organism Group was not defined.",
            );
            return;
        }

        this.allelesLoading = true;
        let project: 'HLA' | 'MHC' =
            this.selectedOrganismGroup === 'HLA' ? 'HLA' : 'MHC';
        let filterOrganismGroup =
            this.selectedOrganismGroup === 'HLA'
                ? undefined
                : this.selectedOrganismGroup;

        this.ebiService
            .getAlleles(
                project,
                pagination == 'prev' ? this.paginationPrevious : undefined,
                pagination == 'next' ? this.paginationNext : undefined,
                this.selectedClass,
                filterOrganismGroup,
            )
            .then((ebiResponse: any) => {
                this.formatAlleleResponse(ebiResponse);
                this.paginationNext = ebiResponse.meta.next;
                this.paginationPrevious = ebiResponse.meta.prev;
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
            if (this.alleleOptions.length === 0) return false;
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

    filterAllelesByQuery() {
        this.filteredAlleles = this.alleleOptions.filter((a) =>
            a.name.includes(this.alleleSearchQuery),
        );
    }

    onAlleleSearch(query: string) {
        this.alleleSearchQuery = query;
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

    onClassChange() {
        this.loadAlleles();
    }

    onOrganismGroupChange() {
        this.loadAlleles();
    }

    addManualAllele() {
        if (this.manualAlleleName == '' || this.manualAlleleMhcClass == '') {
            this.toast.displayMessage(
                'Please enter both name and MHC class for the manual allele.',
                ToastType.INFO,
            );
            return;
        }

        const existingAllele = this.clusteredAlleles.find(
            (a) =>
                a.name === this.manualAlleleName &&
                a.mhc_class === this.manualAlleleMhcClass,
        );

        if (existingAllele) {
            this.toast.displayMessage(
                `Allele ${this.manualAlleleName} already exists.`,
                ToastType.WARNING,
            );
            return;
        }

        const allSubjectIds = this._subjects.map((s) => s.id);

        this.addAlleleToSubjects.emit({
            alleleName: this.manualAlleleName,
            alleleClass: this.manualAlleleMhcClass,
            subjectIds: allSubjectIds,
        });

        const allSubjectInfos: SubjectAlleleInfo[] = this._subjects.map(
            (s) => ({
                subjectId: s.id,
                subjectName: s.name,
                hasAllele: true,
            }),
        );

        this.clusteredAlleles.push({
            name: this.manualAlleleName,
            mhc_class: this.manualAlleleMhcClass,
            subjects: allSubjectInfos,
            totalSubjects: this._subjects.length,
            selectedCount: this._subjects.length,
            showExpanded: false,
        });

        this.filterClusteredAlleles();
        this.manualAlleleName = '';

        this.toast.displayMessage(
            `Successfully added manual allele: ${this.manualAlleleName} to all subjects.`,
            ToastType.SUCCESS,
        );
    }

    getColor(name: string) {
        return UtilitiesService.generateMHCBadgeColor(name);
    }

    closeModal() {
        this.close.emit();
    }
}
