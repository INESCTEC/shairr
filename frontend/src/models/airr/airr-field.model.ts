import { RepertoireModel } from "./repertoire.model";

export interface AirrField {
    category: 'subject' | 'sample' | 'study'; 
    field: string; 
    title: string; 
    value?: any;
    filter?: ((data: RepertoireModel, filterParams: any) => boolean)
}