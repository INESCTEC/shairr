import { Component, OnInit, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { DefaultModalService } from 'src/services/default-modal.service';
import { FormControl, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap, catchError } from 'rxjs/operators';
import { SpeciesTerm } from '../../../../models/shairr/datasources/species.model';
import { SpeciesOntologyService } from '../../../../services/species-api.service';

@Component({
  selector: 'app-species-autocomplete',
  templateUrl: './species-autocomplete.component.html',
  styleUrls: ['./species-autocomplete.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SpeciesAutocompleteComponent),
      multi: true
    }
  ]
})
export class SpeciesAutocompleteComponent {
  @Input() placeholder: string = 'Search species...';
  @Input() disabled: boolean = false;
  @Input() showId: boolean = true;
  @Input() showRank: boolean = true;
  @Input() size: 'sm' | 'lg' | '' = '';
  @Input() restrictTo?: string[];
  @Output() speciesSelected = new EventEmitter<SpeciesTerm | null>();
  
  searchControl = new FormControl('');
  filteredOptions: SpeciesTerm[] = [];
  isLoading = false;
  showDropdown = false;
  selectedTerm: SpeciesTerm | null = null;
  
  commonSpecies: SpeciesTerm[] = [];
  showCommonSpecies = false;
  
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};
  
  constructor(private speciesService: SpeciesOntologyService) {}
  
  ngOnInit(): void {
    this.speciesService.getCommonSpecies().subscribe({
      next: (species) => {
        this.commonSpecies = species;
      },
      error: (err) => {
        console.error('Error loading common species:', err);
        this.commonSpecies = [];
      }
    });
    
    this.searchControl.valueChanges
    .pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => {
        this.isLoading = true;
        this.showDropdown = true;
        this.showCommonSpecies = false;
      }),
      switchMap(value => this._filter(value || '').pipe(
        catchError(() => {
          this.isLoading = false;
          return of([]);
        })
      )),
      tap(() => this.isLoading = false)
    )
    .subscribe(options => {
      this.filteredOptions = this.filterByRank(options);
    });
  }
  
  private _filter(value: string): Observable<SpeciesTerm[]> {
    if (typeof value !== 'string' || value.trim().length < 2) {
      return of([]);
    }
    return this.speciesService.search(value.trim(), 10);
  }
  
  private filterByRank(options: SpeciesTerm[]): SpeciesTerm[] {
    if (!this.restrictTo || this.restrictTo.length === 0) {
      return options;
    }
    return options.filter(term => term.rank && this.restrictTo!.includes(term.rank));
  }
  
  onSelectOption(option: SpeciesTerm): void {
    this.selectedTerm = option;
    this.searchControl.setValue(option.label, { emitEvent: false });
    this.showDropdown = false;
    this.onChange(option);
    this.speciesSelected.emit(option);
  }
  
  clearSelection(): void {
    this.selectedTerm = null;
    this.searchControl.setValue('');
    this.filteredOptions = [];
    this.showDropdown = false;
    this.onChange(null);
    this.speciesSelected.emit(null);
  }
  
  showCommon(): void {
    this.showDropdown = true;
    this.showCommonSpecies = true;
    this.filteredOptions = this.commonSpecies;
  }
  
  onInputBlur(): void {
    setTimeout(() => {
      this.showDropdown = false;
      this.showCommonSpecies = false;
    }, 200);
  }
  
  onInputFocus(): void {
    if (this.searchControl.value && this.searchControl.value.length >= 2) {
      this.showDropdown = true;
    } else if (!this.searchControl.value) {
      this.showCommon();
    }
  }
  
  writeValue(value: SpeciesTerm | null): void {
    if (value) {
      this.selectedTerm = value;
      this.searchControl.setValue(value.label, { emitEvent: false });
    } else {
      this.selectedTerm = null;
      this.searchControl.setValue('');
    }
  }
  
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.searchControl.disable();
    } else {
      this.searchControl.enable();
    }
  }
}