export { CMSClient, type CMSClientOptions } from './client'
export { CollectionClient, type FindManyOptions, type FindOneOptions } from './collection'
export { MediaClient } from './media'
export {
  SearchClient,
  type SearchOptions,
  type CollectionSearchOptions,
  type SuggestOptions,
  type SearchHit,
  type CollectionSearchResult,
  type SearchResult,
  type SuggestResult,
} from './search'
export type {
  Document,
  DocumentMeta,
  DocumentStatus,
  Block,
  Media,
  PaginatedResponse,
  ApiResponse,
  ApiError,
  SeoBlock,
} from './types'
