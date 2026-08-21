import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateEditMetadataComponent } from './create-edit-study.component';

describe('StudyCreateModalComponent', () => {
  let component: CreateEditMetadataComponent;
  let fixture: ComponentFixture<CreateEditMetadataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateEditMetadataComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateEditRepertoireComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
