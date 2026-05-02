import { CMSClient } from '@kritano/cms/sdk';
import type { CMSContext } from './types';
export declare function getCMSClient(): CMSClient;
export declare function useCMS(props: {
    doc?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    collection?: string;
}): CMSContext;
export declare function defineTheme(config: import('@kritano/cms/types').ThemeConfig): import('@kritano/cms/types').ThemeConfig;
//# sourceMappingURL=runtime.d.ts.map