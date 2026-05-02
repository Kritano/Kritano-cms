import type { Document } from "@kritano/cms/types";
export interface Page extends Document {
    title: string;
    slug: string;
    body: Record<string, unknown>;
    content: import("@kritano/cms/types").Block[];
    featuredImage: string | null;
    status: import("@kritano/cms/types").DocumentStatus;
    seo: import("@kritano/cms/types").SeoBlock | null;
}
export interface Article extends Document {
    title: string;
    slug: string;
    body: Record<string, unknown>;
    excerpt: string;
    tags: unknown[];
    featuredImage: string | null;
    publishedAt: string | null;
    status: import("@kritano/cms/types").DocumentStatus;
    seo: import("@kritano/cms/types").SeoBlock | null;
}
export interface Project extends Document {
    title: string;
    slug: string;
    description: Record<string, unknown>;
    url: string | null;
    tags: unknown[];
    images: unknown[];
    status: import("@kritano/cms/types").DocumentStatus;
    seo: import("@kritano/cms/types").SeoBlock | null;
}
export type CollectionName = 'page' | 'article' | 'project';
export interface CollectionTypeMap {
    page: Page;
    article: Article;
    project: Project;
}
//# sourceMappingURL=collections.d.ts.map