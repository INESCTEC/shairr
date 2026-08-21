import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateEditSampleComponent } from './annotate-files.component';

describe('StudyCreateModalComponent', () => {
  let component: CreateEditSampleComponent;
  let fixture: ComponentFixture<CreateEditSampleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateEditSampleComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateEditSampleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
