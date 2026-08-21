import { Injectable } from '@angular/core';
import { ApplicationPlugin } from './plugin.interface';

@Injectable({
    providedIn: 'root'
})
export class PluginLoaderService {
    public async loadPlugins(): Promise<ApplicationPlugin[]> {
        const response = await fetch('/plugins/plugins.json');

        const pluginUrls: string[] = await response.json();

        const loadedPlugins: ApplicationPlugin[] = [];

        for (const pluginUrl of pluginUrls) {
            const pluginModule = await import(
                /* @vite-ignore */
                pluginUrl
            );

            loadedPlugins.push(pluginModule.plugin);
        }

        return loadedPlugins;
    }
}