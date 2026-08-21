import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AirrFilterItemComponent } from './airr-filter-item.component';

describe('AirrFilterItemComponent', () => {
  let component: AirrFilterItemComponent;
  let fixture: ComponentFixture<AirrFilterItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AirrFilterItemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AirrFilterItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
