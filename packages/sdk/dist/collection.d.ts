import type { PaginatedResponse, Document } from '@kritano/cms/types';
import type { CollectionSearchOptions, SearchResult } from './search';
export interface FindManyOptions {
    where?: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'>;
    limit?: number;
    page?: number;
    search?: string;
}
export interface FindOneOptions {
    where: {
        id?: string;
        slug?: string;
    };
}
export declare class CollectionClient<T extends Document = Document> {
    private baseUrl;
    private collectionName;
    private headers;
    constructor(baseUrl: string, collectionName: string, headers: Record<string, string>);
    findMany(options?: FindManyOptions): Promise<PaginatedResponse<T>>;
    findOne(options: FindOneOptions): Promise<T | null>;
    /** Fetch a draft document using a preview token */
    findPreview(id: string, previewToken: string): Promise<T | null>;
    search(options: CollectionSearchOptions): Promise<SearchResult>;
}
//# sourceMappingURL=collection.d.ts.map