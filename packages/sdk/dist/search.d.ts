export interface SearchOptions {
    q: string;
    collections?: string[];
    limit?: number;
    page?: number;
}
export interface CollectionSearchOptions {
    q: string;
    filter?: string;
    sort?: string;
    limit?: number;
    page?: number;
}
export interface SuggestOptions {
    q: string;
    collection?: string;
    limit?: number;
}
export interface SearchHit {
    id: string;
    collection: string;
    title: string;
    slug?: string;
    excerpt?: string;
    publishedAt?: string;
    score: number;
}
export interface CollectionSearchResult {
    total: number;
    hits: SearchHit[];
}
export interface SearchResult {
    query: string;
    took_ms: number;
    results: Record<string, CollectionSearchResult>;
    search_unavailable?: boolean;
}
export interface SuggestResult {
    suggestions: string[];
    search_unavailable?: boolean;
}
export declare class SearchClient {
    private baseUrl;
    private headers;
    constructor(baseUrl: string, headers: Record<string, string>);
    /** Global search across all collections */
    search(options: SearchOptions): Promise<SearchResult>;
    /** Collection-scoped search */
    searchCollection(collection: string, options: CollectionSearchOptions): Promise<SearchResult>;
    /** Autocomplete suggestions */
    suggest(options: SuggestOptions): Promise<SuggestResult>;
}
//# sourceMappingURL=search.d.ts.map