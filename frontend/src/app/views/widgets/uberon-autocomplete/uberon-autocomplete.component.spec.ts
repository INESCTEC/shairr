import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UberonAutocompleteComponent } from './uberon-autocomplete.component';

describe('UberonAutocompleteComponent', () => {
  let component: UberonAutocompleteComponent;
  let fixture: ComponentFixture<UberonAutocompleteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UberonAutocompleteComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(UberonAutocompleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});