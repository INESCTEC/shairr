export interface FeatureLinkModel {
    title: string;
    link: string;
}

export interface FeatureModel {
    id?: string;
    title: string;
    icon: string;
    description?: string;
    class: string;
    link?: string;
    links: FeatureLinkModel[];
    active: boolean | Function;
};