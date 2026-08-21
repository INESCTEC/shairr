import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'src/services/authentication.service';
import { RouteGuards } from 'src/services/route-guards';
import { DefaultLayoutComponent } from './containers/default-layout/default-layout.component';
import { LoginComponent } from './views/pages/login/login.component';
import { Page401Component } from './views/pages/page401/page401.component';
import { Page404Component } from './views/pages/page404/page404.component';
import { Page500Component } from './views/pages/page500/page500.component';
import { RegisterComponent } from './views/pages/register/register.component';


const routes: Routes = [
    {
        path: '',
        redirectTo: 'repository',
        pathMatch: 'full'
    },
    {
        path: '',
        component: DefaultLayoutComponent,

        canActivate: [AuthGuard],
        children: [
            {
                path: 'settings',
                loadChildren: () => import('./views/settings/settings.module').then((m) => m.SettingsModule)
            },
            {
                path: 'repository',
                loadChildren: () => import('./views/repository/repository.module').then((m) => m.RepositoryModule)
            },
            {
                path: 'pages',
                canActivate: [RouteGuards.hasSelectedWorkspace],
                loadChildren: () => import('./views/pages/pages.module').then((m) => m.PagesModule)
            },
        ]
    },
    {
        path: '401',
        component: Page401Component,
        data: {
            title: 'Page 401',
        }
    },
    {
        path: '404',
        component: Page404Component,
        data: {
            title: 'Page 404'
        }
    },
    {
        path: '500',
        component: Page500Component,
        data: {
            title: 'Page 500'
        }
    },
    {
        path: 'login',
        component: LoginComponent,
        data: {
            title: 'Login Page'
        }
    },
    {
        path: 'register',
        component: RegisterComponent,
        data: {
            title: 'Register Page'
        }
    },
    { path: '**', redirectTo: 'home', pathMatch: 'full' }
];

@NgModule({
    imports: [
        RouterModule.forRoot(routes, {
            scrollPositionRestoration: 'top',
            anchorScrolling: 'enabled'
        })
    ],
    exports: [RouterModule]
})
export class AppRoutingModule {
}
