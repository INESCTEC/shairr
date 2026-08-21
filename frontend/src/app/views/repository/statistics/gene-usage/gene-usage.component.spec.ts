import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeneUsageComponent } from './gene-usage.component';

describe('GeneUsageComponent', () => {
  let component: GeneUsageComponent;
  let fixture: ComponentFixture<GeneUsageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeneUsageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeneUsageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
