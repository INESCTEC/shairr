import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AirrFilterComponent } from './airr-filter.component';

describe('AirrFilterComponent', () => {
  let component: AirrFilterComponent;
  let fixture: ComponentFixture<AirrFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AirrFilterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AirrFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
