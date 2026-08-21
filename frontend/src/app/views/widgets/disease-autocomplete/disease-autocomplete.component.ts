import { Component, OnInit, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { DefaultModalService } from 'src/services/default-modal.service';
import { FormControl, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap, catchError } from 'rxjs/operators';
import { DiseaseTerm } from '../../../../models/shairr/datasources/disease.model';
import { DiseaseOntologyService } from '../../../../services/disease-api.service';
import { OntologyModel } from '../../../../models/airr/ontology.model';

@Component({
  selector: 'app-disease-autocomplete',
  templateUrl: './disease-autocomplete.component.html',
  styleUrls: ['./disease-autocomplete.component.scss'],
})
export class DiseaseAutocompleteComponent implements OnInit {
  @Input() placeholder: string = 'Search disease...';
  @Input() disabled: boolean = false;
  @Input() showId: boolean = true;
  @Input() size: 'sm' | 'lg' | '' = '';
  @Input() initialValue: DiseaseTerm | OntologyModel | null = null;
  @Input() displayText: string = '';
  @Output() diseaseSelected = new EventEmitter<DiseaseTerm | null>();
  
  searchControl = new FormControl('');
  filteredOptions: DiseaseTerm[] = [];
  isLoading = false;
  showDropdown = false;
  selectedTerm: DiseaseTerm | null = null;
  
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private diseaseService: DiseaseOntologyService) {}

  ngOnInit(): void {
    if (this.initialValue) {
      this.selectedTerm = this.initialValue as DiseaseTerm | null;
      this.searchControl.setValue(this.displayText || (this.initialValue as DiseaseTerm)?.label || '', { emitEvent: false });
    }

    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => {
          this.isLoading = true;
          this.showDropdown = true;
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
        this.filteredOptions = options;
      });
  }

  private _filter(value: string): Observable<DiseaseTerm[]> {
    if (typeof value !== 'string' || value.trim().length < 2) {
      return of([]);
    }
    
    return this.diseaseService.search(value.trim(), 10);
  }

  onSelectOption(option: DiseaseTerm): void {
    this.selectedTerm = option;
    this.searchControl.setValue(option.label, { emitEvent: false });
    this.showDropdown = false;
    this.onChange(option);
    this.diseaseSelected.emit(option);
  }

  clearSelection(): void {
    this.selectedTerm = null;
    this.searchControl.setValue('');
    this.filteredOptions = [];
    this.showDropdown = false;
    this.onChange(null);
    this.diseaseSelected.emit(null);
  }

  onInputBlur(): void {
    setTimeout(() => {
      this.showDropdown = false;
    }, 200);
  }

  onInputFocus(): void {
    if (this.searchControl.value && this.searchControl.value.length >= 2) {
      this.showDropdown = true;
    }
  }

  writeValue(value: DiseaseTerm | null): void {
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