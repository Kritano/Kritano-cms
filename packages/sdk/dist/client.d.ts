import type { Document } from '@kritano/cms/types';
import { CollectionClient } from './collection';
import { MediaClient } from './media';
import { SearchClient } from './search';
export interface CMSClientOptions {
    url: string;
    apiKey?: string;
    previewToken?: string;
}
export declare class CMSClient {
    private baseUrl;
    private headers;
    media: MediaClient;
    search: SearchClient;
    constructor(options: CMSClientOptions);
    collection<T extends Document = Document>(name: string): CollectionClient<T>;
}
//# sourceMappingURL=client.d.ts.map