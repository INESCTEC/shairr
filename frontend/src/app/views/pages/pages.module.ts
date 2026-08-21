import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { ButtonModule, CardModule, FormModule, GridModule } from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';
import { DefaultModalComponent } from '../widgets/default-modal/default-modal.component';
import { LoginComponent } from './login/login.component';
import { Page401Component } from './page401/page401.component';
import { Page404Component } from './page404/page404.component';
import { Page500Component } from './page500/page500.component';
import { PagesRoutingModule } from './pages-routing.module';
import { RegisterComponent } from './register/register.component';


@NgModule({
  declarations: [
    LoginComponent,
    RegisterComponent,
    Page401Component,
    Page404Component,
    Page500Component
  ],
  imports: [
    CommonModule,
    PagesRoutingModule,
    CardModule,
    DefaultModalComponent,
    ButtonModule,
    GridModule,
    IconModule,
    FormModule
  ]
})
export class PagesModule {
}
