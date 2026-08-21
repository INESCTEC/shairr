import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TopClonesComponent } from './top-clones.component';

describe('TopClonesComponent', () => {
  let component: TopClonesComponent;
  let fixture: ComponentFixture<TopClonesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopClonesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TopClonesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
