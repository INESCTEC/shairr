import { Component } from '@angular/core';
import { DefaultModalService } from 'src/services/default-modal.service';
import { Router } from '@angular/router';
import { UnauthorizedException } from 'src/models/exceptions';


/**
 * Page for managing unauthorized access.
 * The page shows a default generic error message with can be overriden through this page's location state.
 * For example through Angular's router:
 * this.router.navigate(['401'], { state: {
 *          exception: new UnauthorizedException('Whoops! You're not allowed here because of a very specific reason!')
 *      }
 *  })
 *
 */
@Component({
    selector: 'app-page401',
    templateUrl: './page401.component.html',
})
export class Page401Component {
    /**
     * Hold error message that will be displayed to the user.
     * Has a default message.
     */
    unauthorized!: UnauthorizedException;

    constructor(
        private router: Router
    ) {
        this.unauthorized = this.router.getCurrentNavigation()?.
                                    extras?.
                                    state?.['exception'] as UnauthorizedException;
    }

    clearSession() {
        this.router.navigate(['.']);
    }

}
