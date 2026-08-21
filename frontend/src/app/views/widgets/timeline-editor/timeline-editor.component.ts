import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { TimepointModel } from '../../../../models/shairr/datasources/timepoint.model';
import { SubjectModel } from '../../../../models/shairr/datasources/subject.model';
import { SampleModel } from '../../../../models/shairr/datasources/sample.model';
import { DefaultModalService } from 'src/services/default-modal.service';
import { ToastService, ToastType } from 'src/services/toast.service';
import { DatasourcesApiService } from 'src/services/datasources-api.service';

@Component({
  selector: 'app-timeline-editor',
  templateUrl: './timeline-editor.component.html',
  styleUrls: ['./timeline-editor.component.scss']
})
export class TimelineEditorComponent implements OnInit, OnChanges {
  @ViewChild('timelineContainer') timelineContainer!: ElementRef;
  
  @Input() subjectId: number = 0;
  @Input() sampleId: number | null = null;
  @Input() currentTimepointId: number | null = null;
  @Input() subjects: SubjectModel[] = [];
  @Input() samples: SampleModel[] = [];
  @Input() mode: 'subject' | 'sample' = 'subject';
  @Output() timepointCreated = new EventEmitter<TimepointModel>();
  @Output() timepointUpdated = new EventEmitter<TimepointModel>();
  @Output() timepointDeleted = new EventEmitter<number>();
  @Output() sampleAssigned = new EventEmitter<number>();
  @Output() sampleUnassigned = new EventEmitter<number>();

  timepoints: TimepointModel[] = [];
  displayTimepoints: TimepointModel[] = [];
  editMode: { [key: number]: boolean } = {};
  loading: boolean = false;
  activeEditId: number | null = null;

  isDragging: boolean = false;
  dragStartX: number = 0;
  dragStartScrollLeft: number = 0;
  dragThreshold: number = 5;
  dragDistance: number = 0;
  private isSelectingText: boolean = false;
  private mouseDownTarget: HTMLElement | null = null;

  constructor(
    private datasourcesApiService: DatasourcesApiService,
    private toastService: ToastService,
    private modalService: DefaultModalService
  ) {}

  ngOnInit() {
    this.loadTimepoints();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['subjectId'] && !changes['subjectId'].firstChange) {
      this.loadTimepoints();
    }
  }

  async loadTimepoints() {
    if (!this.subjectId || this.subjectId === 0) {
      this.timepoints = [];
      this.displayTimepoints = [];
      return;
    }

    this.loading = true;
    this.timepoints = await this.datasourcesApiService
      .getSubjectTimepoints(this.subjectId)
      .then((response: any) => response.json())
      .catch(() => []);

    this.timepoints.forEach((tp) => {
      this.editMode[tp.id] = false;
    })

    this.updateDisplayTimepoints();
    this.loading = false;
  }

  updateDisplayTimepoints() {
    this.displayTimepoints = [...this.timepoints].sort((a, b) => {
      if (a.id_relative_time_point == null && b.id_relative_time_point == null) return 0;
      if (a.id_relative_time_point == null) return 1;
      if (b.id_relative_time_point == null) return -1;
      return a.id_relative_time_point - b.id_relative_time_point;
    });
  }

  editModeToggle(timepointId: number) {
    if (this.activeEditId !== null && this.activeEditId !== timepointId) {
      this.editMode[this.activeEditId] = false;
    }
    
    this.editMode[timepointId] = !this.editMode[timepointId];
    this.activeEditId = this.editMode[timepointId] ? timepointId : null;
  }

  isEditModeOn(): boolean {
    return this.activeEditId !== null;
  }

  async addTimepoint() {
    if (!this.subjectId) {
      this.toastService.displayMessage('No subject selected.', ToastType.WARNING);
      return;
    }

    const newTimepoint: TimepointModel = {
      id: 0,
      id_subject: this.subjectId,
      units_of_measurement: 'days',
      time_point: 0,
      description: 'New Timepoint',
      id_relative_time_point: null
    };

    this.loading = true;
    await this.datasourcesApiService
      .createTimepoint(newTimepoint)
      .then((response: any) => response.json())
      .then(async (created: TimepointModel) => {
        this.toastService.displayMessage('Timepoint added successfully.', ToastType.SUCCESS);
        this.loadTimepoints();
        await this.timepointCreated.emit(created);
        await this.assignToSample(created.id);
      })
      .catch(() => {
        this.toastService.displayMessage('Failed to add timepoint.', ToastType.ERROR);
      })
      .finally(() => {
        this.loading = false;
      });
  }

  async saveTimepoint(timepoint: TimepointModel) {
    this.loading = true;

    const updatePayload = {
      id_subject: Number(timepoint.id_subject),
      id_relative_time_point: timepoint.id_relative_time_point == null ? null : Number(timepoint.id_relative_time_point),
      time_point: Number(timepoint.time_point),
      units_of_measurement: String(timepoint.units_of_measurement),
      description: String(timepoint.description)
    };

    await this.datasourcesApiService
      .updateTimepoint(timepoint.id, updatePayload)
      .then(() => {
        this.toastService.displayMessage('Timepoint saved successfully.', ToastType.SUCCESS);
        this.loadTimepoints();
        this.timepointUpdated.emit(timepoint);
      })
      .catch(() => {
        this.toastService.displayMessage('Failed to save timepoint.', ToastType.ERROR);
      })
      .finally(() => {
        this.loading = false;
      });
  }

  async deleteTimepoint(timepointId: number) {
    const confirmed = await this.modalService.confirm({
      title: 'Delete Timepoint',
      message: 'Are you sure you want to delete this timepoint?',
      type: 'confirm'
    });

    if (!confirmed) return;

    this.loading = true;
    await this.datasourcesApiService
      .deleteTimepoint(timepointId)
      .then(() => {
        this.toastService.displayMessage('Timepoint deleted successfully.', ToastType.SUCCESS);
        this.timepoints = this.timepoints.filter(tp => tp.id !== timepointId);
        this.updateDisplayTimepoints();
        this.timepointDeleted.emit(timepointId);
        if (this.activeEditId === timepointId) {
          this.activeEditId = null;
        }
      })
      .catch(() => {
        this.toastService.displayMessage('Failed to delete timepoint.', ToastType.ERROR);
      })
      .finally(() => {
        this.loading = false;
      });
  }

  assignToSample(timepointId: number) {
    this.sampleAssigned.emit(timepointId);
  }

  unassignToSample(timepointId: number) {
    console.log('here!')
    this.sampleUnassigned.emit(timepointId);
  }

  getSampleFromTimepoint(timepointId: number): SampleModel | undefined {
    return this.samples.find(s => s.id_timepoint === timepointId);
  }

  onWheel(event: WheelEvent) {
    const container = this.timelineContainer?.nativeElement;
    if (container) {
      container.scrollLeft += event.deltaY;
      event.preventDefault();
    }
  }

  onMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    this.mouseDownTarget = target;
    
    if (this.isInteractiveElement(target)) {
      this.isSelectingText = false;
      return;
    }
    
    const isSelectable = this.isSelectableTextElement(target);
    
    if (isSelectable) {
      this.isSelectingText = true;
      return;
    }
    
    if (event.button === 0) {
      this.isDragging = false;
      this.isSelectingText = false;
      this.dragDistance = 0;
      this.dragStartX = event.pageX;
      this.dragStartScrollLeft = this.timelineContainer?.nativeElement?.scrollLeft || 0;
      event.preventDefault();
    }
  }

  onMouseMove(event: MouseEvent): void {
    if (this.isSelectingText) {
      return;
    }
    
    if (this.dragStartX === 0) return;
    
    const dx = event.pageX - this.dragStartX;
    this.dragDistance = Math.abs(dx);
    
    if (!this.isDragging && this.dragDistance > this.dragThreshold) {
      this.isDragging = true;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      
      if (this.timelineContainer) {
        this.timelineContainer.nativeElement.style.cursor = 'grabbing';
      }
    }
    
    if (this.isDragging && this.timelineContainer) {
      const scrollAmount = this.dragStartScrollLeft - dx;
      this.timelineContainer.nativeElement.scrollLeft = scrollAmount;
      event.preventDefault();
    }
  }

  onMouseUp(event: MouseEvent): void {
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartScrollLeft = 0;
    this.dragDistance = 0;
    
    setTimeout(() => {
      this.isSelectingText = false;
      this.mouseDownTarget = null;
    }, 50);
    
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    if (this.timelineContainer) {
      this.timelineContainer.nativeElement.style.cursor = '';
    }
  }

  onCardMouseDown(event: MouseEvent, timepoint: TimepointModel): void {
    const target = event.target as HTMLElement;
    
    if (this.isSelectableTextElement(target)) {
      this.isSelectingText = true;
      event.stopPropagation();
      return;
    }
    
    if (this.isInteractiveElement(target)) {
      event.stopPropagation();
      return;
    }
  }

  private isSelectableTextElement(element: HTMLElement): boolean {
    let current = element;
    while (current && current !== document.body) {
      if (current.classList?.contains('selectable-text') ||
          current.classList?.contains('timeline-description') ||
          current.classList?.contains('label') ||
          current.tagName === 'TD' ||
          current.tagName === 'SPAN' ||
          current.tagName === 'STRONG') {
        return true;
      }
      current = current.parentElement as HTMLElement;
    }
    return false;
  }

  private isInteractiveElement(element: HTMLElement): boolean {
    let current = element;
    while (current && current !== document.body) {
      const tagName = current.tagName.toLowerCase();
      const isInteractive = tagName === 'button' ||
                           tagName === 'input' ||
                           tagName === 'select' ||
                           tagName === 'textarea' ||
                           current.classList?.contains('btn-edit') ||
                           current.classList?.contains('btn-save') ||
                           current.classList?.contains('btn-delete') ||
                           current.classList?.contains('btn-assign') ||
                           current.classList?.contains('btn-current') ||
                           current.classList?.contains('timeline-add-icon') ||
                           current.getAttribute('contenteditable') === 'true';
      
      if (isInteractive) {
        return true;
      }
      current = current.parentElement as HTMLElement;
    }
    return false;
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.timelineContainer) return;
    
    if (event.key === 'ArrowLeft') {
      this.timelineContainer.nativeElement.scrollLeft -= 100;
      event.preventDefault();
    } else if (event.key === 'ArrowRight') {
      this.timelineContainer.nativeElement.scrollLeft += 100;
      event.preventDefault();
    }
  }

  ngOnDestroy(): void {
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }
}