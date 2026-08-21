import { Routes } from '@angular/router';

export interface ApplicationPlugin {
    getRoutes(): Routes;
}