import { Component } from '@angular/core';
import { RepositoryModel } from '../../../../models/shairr/repository.model';
import { UserModel } from '../../../../models/shairr/user.model';
import { DatasourcesApiService } from '../../../../services/datasources-api.service';
import { ToastService } from '../../../../services/toast.service';

interface PropertyEntry {
    key: string;
    value: string;
}

@Component({
    templateUrl: 'general-settings.component.html',
    styleUrls: ['general-settings.component.scss'],
})
export class GeneralSettingsComponent {
    repository: RepositoryModel = {
        id: '1',
        name: ''
    };

    user: UserModel = {
        properties: {}
    };

    propertyEntries: PropertyEntry[] = [];

    constructor(
        private datasourcesApiService: DatasourcesApiService,
        private toastService: ToastService
    ) {
        this.getRepositoryName();
        this.loadUser();
    }

    async loadUser() {
        this.user = await this.datasourcesApiService.getUser();

        this.propertyEntries = Object.entries(this.user.properties ?? {})
            .map(([key, value]) => ({
                key,
                value
            }));

        this.ensureEmptyPropertyRow();
    }

    removeProperty(index: number): void {
        this.propertyEntries.splice(index, 1);

        this.ensureEmptyPropertyRow();
    }

    onPropertyChanged(): void {
        this.ensureEmptyPropertyRow();
    }

    async saveProperties(): Promise<void> {
        const properties: { [key: string]: string } = {};

        for (const propertyEntry of this.propertyEntries) {
            const propertyKey = propertyEntry.key.trim();

            if (!propertyKey) {
                continue;
            }

            properties[propertyKey] = propertyEntry.value;
        }

        this.user.properties = properties;

        try {
            const response = await this.datasourcesApiService.updateUser({ properties });

            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            this.toastService.displayMessage('User properties saved successfully.');
        } catch (error) {
            console.error('Failed to save user properties.', error);

            this.toastService.displayMessage('Failed to save user properties. Please check console for details.');
        }
    }

    async getRepositoryName() {
        this.repository = await this.datasourcesApiService
            .getRepository()
            .then((response: any) => {
                return response.json();
            });
    }

    async saveRepositoryName(event: Event) {
        this.datasourcesApiService
            .updateRepository({
                name: this.repository.name
            })
            .then((response: RepositoryModel) => {
                this.repository = response;
            });
    }

    private ensureEmptyPropertyRow(): void {
        const emptyRows = this.propertyEntries.filter(
            (propertyEntry) =>
                !propertyEntry.key.trim() &&
                !propertyEntry.value.trim()
        );

        if (emptyRows.length === 0) {
            this.propertyEntries.push({
                key: '',
                value: ''
            });
        } else if (emptyRows.length > 1) {
            let firstEmptyFound = false;

            this.propertyEntries = this.propertyEntries.filter((propertyEntry) => {
                const isEmpty =
                    !propertyEntry.key.trim() &&
                    !propertyEntry.value.trim();

                if (!isEmpty) {
                    return true;
                }

                if (!firstEmptyFound) {
                    firstEmptyFound = true;
                    return true;
                }

                return false;
            });
        }
    }
}
