export interface CMSIntegrationOptions {
    apiUrl?: string;
}
export declare function cmsIntegration(_options?: CMSIntegrationOptions): {
    name: string;
    hooks: {
        'astro:config:setup': ({ updateConfig }: any) => void;
    };
};
//# sourceMappingURL=integration.d.ts.map