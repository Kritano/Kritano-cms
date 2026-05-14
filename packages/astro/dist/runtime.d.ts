import { CMSClient } from '@kritano/cms/sdk';
import type { CMSContext } from './types';
export declare function getCMSClient(previewToken?: string): CMSClient;
export declare function useCMS(props: {
    doc?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    collection?: string;
}): CMSContext;
export declare function defineTheme(config: import('@kritano/cms/types').ThemeConfig): import('@kritano/cms/types').ThemeConfig;
/**
 * Check if the current request is a preview request and validate the token.
 * Returns the preview token if valid, null otherwise.
 */
export declare function getPreviewToken(url: URL): Promise<string | null>;
/**
 * Generate the preview banner HTML to inject into preview pages.
 */
export declare function getPreviewBannerHtml(): string;
//# sourceMappingURL=runtime.d.ts.map