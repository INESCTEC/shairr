import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CellAutocompleteComponent } from './cell-autocomplete.component';

describe('CellAutocompleteComponent', () => {
  let component: CellAutocompleteComponent;
  let fixture: ComponentFixture<CellAutocompleteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CellAutocompleteComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CellAutocompleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});