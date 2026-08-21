import { ActionModel } from "./action.model";

export interface ToolModel {
    id: number;
    name: string;
    install_script: string;
    installed: boolean;
    actions: ActionModel[];
    properties?: { [key: string]: any };
}
