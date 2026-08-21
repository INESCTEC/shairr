import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CellTerm } from '../../../../models/shairr/datasources/cell.model';
import { DatasourcesApiService } from '../../../../services/datasources-api.service';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
    selector: 'app-cell-autocomplete',
    templateUrl: './cell-autocomplete.component.html',
    styleUrls: ['./cell-autocomplete.component.scss']
})
export class CellAutocompleteComponent implements OnInit {
    @Input() placeholder: string = 'Search...';
    @Input() showId: boolean = false;
    @Input() initialValue: CellTerm | null = null;
    @Input() displayText: string = '';
    @Output() cellSelected = new EventEmitter<CellTerm | null>();

    searchTerm: string = '';
    suggestions: CellTerm[] = [];
    showSuggestions: boolean = false;
    selectedTerm: CellTerm | null = null;
    private searchSubject = new Subject<string>();

    constructor(private apiService: DatasourcesApiService) {
        this.searchSubject.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(term => this.apiService.searchCell(term))
        ).subscribe(results => {
            this.suggestions = results;
            this.showSuggestions = true;
        });
    }

    ngOnInit(): void {
        if (this.initialValue) {
            this.selectedTerm = this.initialValue;
            this.searchTerm = this.displayText || this.initialValue.label;
        }
    }

    onInput(event: any): void {
        const term = event.target.value;
        this.searchTerm = term;
        if (term.length >= 2) {
            this.searchSubject.next(term);
        } else {
            this.suggestions = [];
            this.showSuggestions = false;
        }
    }

    onFocus(): void {
        if (this.suggestions.length > 0) {
            this.showSuggestions = true;
        }
    }

    onBlur(): void {
        setTimeout(() => {
            this.showSuggestions = false;
        }, 200);
    }

    selectTerm(term: CellTerm): void {
        this.selectedTerm = term;
        this.searchTerm = term.label;
        this.cellSelected.emit(term);
        this.showSuggestions = false;
    }

    clearSelection(): void {
        this.selectedTerm = null;
        this.searchTerm = '';
        this.suggestions = [];
        this.showSuggestions = false;
        this.cellSelected.emit(null);
    }
}