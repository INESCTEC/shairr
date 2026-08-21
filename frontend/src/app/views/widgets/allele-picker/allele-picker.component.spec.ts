import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MhcSelectorComponent } from './allele-picker.component';

describe('MhcSelectorComponent', () => {
  let component: MhcSelectorComponent;
  let fixture: ComponentFixture<MhcSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MhcSelectorComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(MhcSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
