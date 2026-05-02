import type { PaginatedResponse, Media } from '@kritano/cms/types';
export declare class MediaClient {
    private baseUrl;
    private headers;
    constructor(baseUrl: string, headers: Record<string, string>);
    list(options?: {
        page?: number;
        limit?: number;
    }): Promise<PaginatedResponse<Media>>;
    get(id: string): Promise<Media | null>;
}
//# sourceMappingURL=media.d.ts.map