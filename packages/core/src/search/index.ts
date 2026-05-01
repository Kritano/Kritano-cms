export {
  getSearchClient,
  getTypesenseConfig,
  isSearchAvailable,
  checkSearchHealth,
  resetSearchClient,
} from './client'

export {
  buildTypesenseSchema,
  syncSchemas,
} from './schema-sync'

export {
  extractText,
  toSearchDocument,
  upsertDocument,
  deleteDocument,
  reindexCollection,
  clearCollection,
} from './indexer'

export {
  searchCollections,
  searchSuggest,
  type SearchParams,
  type SearchHit,
  type CollectionSearchResult,
  type GlobalSearchResult,
  type SuggestResult,
} from './queries'
