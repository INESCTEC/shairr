import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule, HashLocationStrategy, LocationStrategy } from '@angular/common';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule, Title } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';

import { AppComponent } from './app.component';

import {
    DefaultFooterComponent,
    DefaultHeaderComponent,
    DefaultLayoutComponent,
    RoadmapComponent
} from './containers';

import {
    AccordionModule,
    AvatarModule,
    BadgeModule,
    BreadcrumbModule,
    ButtonGroupModule,
    ButtonModule,
    CalloutModule,
    CardModule,
    DropdownModule,
    FooterModule,
    FormModule,
    GridModule,
    HeaderModule,
    ListGroupModule,
    ModalModule,
    NavModule,
    NavbarModule,
    OffcanvasModule,
    PopoverModule,
    ProgressModule,
    SharedModule,
    SidebarModule,
    TabsModule,
    TooltipModule,
    UtilitiesModule,
} from '@coreui/angular';


import { provideHttpClient } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { IconModule, IconSetService } from '@coreui/icons-angular';
import { KeycloakAngularModule, KeycloakService } from 'keycloak-angular';
import { initializeKeycloak } from 'src/services/authentication.service';
import { UtilitiesService } from 'src/services/utilities.service';
import { WidgetsModule } from './views/widgets/widgets.module';
import { DefaultModalComponent } from './views/widgets/default-modal/default-modal.component';
import { DefaultNotificationsComponent } from './containers/default-layout/default-notifications/default-notifications.component';


const APP_CONTAINERS = [
    DefaultFooterComponent,
    DefaultHeaderComponent,
    DefaultNotificationsComponent,
    DefaultLayoutComponent,
    RoadmapComponent,
];

@NgModule({
    declarations: [AppComponent, ...APP_CONTAINERS],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        AppRoutingModule,
        CommonModule,
        FormsModule,
        IconModule,
        AvatarModule,
        BreadcrumbModule,
        CalloutModule,
        FooterModule,
        DropdownModule,
        GridModule,
        HeaderModule,
        DefaultModalComponent,
        SidebarModule,
        IconModule,
        NavModule,
        ButtonModule,
        FormModule,
        UtilitiesModule,
        ButtonGroupModule,
        ReactiveFormsModule,
        SidebarModule,
        SharedModule,
        TabsModule,
        ListGroupModule,
        PopoverModule,
        ProgressModule,
        BadgeModule,
        ListGroupModule,
        CardModule,
        ModalModule,
        AccordionModule,
        WidgetsModule,
        NavbarModule,
        OffcanvasModule,
        KeycloakAngularModule,
        TooltipModule,
        DragDropModule,
    ],
    providers: [
        provideHttpClient(),
        {
            provide: APP_INITIALIZER,
            useFactory: initializeKeycloak,
            multi: true,
            deps: [KeycloakService],
        },
        {
            provide: LocationStrategy,
            useClass: HashLocationStrategy,
        },
        {
            provide: RoadmapComponent,
            useClass: RoadmapComponent,
        },
        IconSetService,
        Title,
        UtilitiesService,
    ],
    bootstrap: [AppComponent],
})
export class AppModule { }
