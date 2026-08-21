import { Component, OnInit, Input } from '@angular/core';
import { DatasourcesApiService } from 'src/services/datasources-api.service';

@Component({
  selector: 'app-default-notifications',
  templateUrl: './default-notifications.component.html',
  styleUrls: ['./default-notifications.component.scss'],
})
export class DefaultNotificationsComponent implements OnInit {
  @Input() offcanvasVisible: boolean = false;
  
  notifications: any[] = [];
  filteredNotifications: any[] = [];
  loading: boolean = false;
  showReadNotifications: boolean = true;

  datasourcesApi: DatasourcesApiService;

  constructor(datasourcesApi: DatasourcesApiService) { 
    this.datasourcesApi = datasourcesApi;
  }

  ngOnInit(): void {
    this.loadNotifications();
  }

  handleVisibleChange(visible: boolean): void {
    if (visible) {
      this.loadNotifications();
    }
  }

  closeOffcanvas(): void {
    this.offcanvasVisible = false;
  }

  today: Date = new Date();

  toggleReadNotifications(): void {
    this.showReadNotifications = !this.showReadNotifications;
    this.applyFilter();
  }

  applyFilter(): void {
    if (this.showReadNotifications) {
      this.filteredNotifications = [...this.notifications];
    } else {
      this.filteredNotifications = this.notifications.filter(n => !n.read);
    }
  }

  loadNotifications(): void {
    this.loading = true;
    /*this.datasourcesApi.getNotifications(undefined).then((data: any[]) => {
      this.notifications = data;
      this.sortNotifications();
      this.applyFilter();
      this.loading = false;
    }).catch((error: any) => {
        console.error('Error loading notifications', error);
        this.loading = false;
      }
    );*/
  }

  sortNotifications() {
    this.notifications.sort((a, b) => {
      if (a.read === b.read) {
        const dateA = new Date(a.timestamp || a.createdAt || a.date);
        const dateB = new Date(b.timestamp || b.createdAt || b.date);
        return dateB.getTime() - dateA.getTime();
      }

      return a.read ? 1 : -1;
    });
  }

  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      //await this.shairrApi.markAsRead({ id: notification.id });
      // Re-sort and re-apply filter after marking as read
      this.sortNotifications();
      this.applyFilter();
    }
  }

  getToastColor(level: string): string {
    switch (level?.toLowerCase()) {
      case 'success': return '#28a745';
      case 'error': return '#dc3545';
      case 'warning': return '#ffc107';
      case 'info': return '#272a2f';
      default: return '#272a2f';
    }
  }

  getToastGradient(level: string): string {
    const color = this.getToastBackgroundColor(level);
    return `linear-gradient(to bottom, ${color} 0%, white 100%)`;
  }

  getToastBackgroundColor(level: string): string {
    switch (level?.toLowerCase()) {
      case 'success': return '#c3e6cb';
      case 'error': return '#f5c6cb';
      case 'warning': return '#ffeaa1';
      case 'info': return '#b5c2d9';
      default: return '#b5c2d9';
    }
  }

  getToastIcon(level: string): string {
    switch (level?.toLowerCase()) {
      case 'success': return 'fa-check';
      case 'error': return 'fa-exclamation-triangle';
      case 'warning': return 'fa-exclamation-circle';
      case 'info': return 'fa-info-circle';
      default: return 'fa-info-circle';
    }
  }
}