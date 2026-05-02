// @bun
// src/collection.ts
class CollectionClient {
  baseUrl;
  collectionName;
  headers;
  constructor(baseUrl, collectionName, headers) {
    this.baseUrl = baseUrl;
    this.collectionName = collectionName;
    this.headers = headers;
  }
  async findMany(options = {}) {
    const params = new URLSearchParams;
    if (options.page)
      params.set("page", String(options.page));
    if (options.limit)
      params.set("limit", String(options.limit));
    if (options.search)
      params.set("search", options.search);
    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        params.set(key, String(value));
      }
    }
    if (options.orderBy) {
      const [field, order] = Object.entries(options.orderBy)[0];
      params.set("sort", field);
      params.set("order", order);
    }
    const query = params.toString();
    const url = `${this.baseUrl}/${this.collectionName}${query ? `?${query}` : ""}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`SDK: ${res.status} fetching ${this.collectionName} list`);
    }
    return res.json();
  }
  async findOne(options) {
    let url;
    if (options.where.slug) {
      url = `${this.baseUrl}/${this.collectionName}/slug/${options.where.slug}`;
    } else if (options.where.id) {
      url = `${this.baseUrl}/${this.collectionName}/${options.where.id}`;
    } else {
      throw new Error("SDK: findOne requires either id or slug");
    }
    const res = await fetch(url, { headers: this.headers });
    if (res.status === 404)
      return null;
    if (!res.ok) {
      throw new Error(`SDK: ${res.status} fetching ${this.collectionName}`);
    }
    const body = await res.json();
    return body.data;
  }
  async findPreview(id, previewToken) {
    const url = `${this.baseUrl}/${this.collectionName}/${id}/preview?cms_preview=${encodeURIComponent(previewToken)}`;
    const res = await fetch(url, { headers: this.headers });
    if (res.status === 404)
      return null;
    if (res.status === 401)
      throw new Error("SDK: Invalid or expired preview token");
    if (!res.ok)
      throw new Error(`SDK: ${res.status} fetching preview`);
    const body = await res.json();
    return body.data;
  }
  async search(options) {
    const params = new URLSearchParams;
    params.set("q", options.q);
    if (options.filter)
      params.set("filter", options.filter);
    if (options.sort)
      params.set("sort", options.sort);
    if (options.limit)
      params.set("limit", String(options.limit));
    if (options.page)
      params.set("page", String(options.page));
    const res = await fetch(`${this.baseUrl}/search/${this.collectionName}?${params}`, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`SDK: ${res.status} searching ${this.collectionName}`);
    }
    return res.json();
  }
}

// src/media.ts
class MediaClient {
  baseUrl;
  headers;
  constructor(baseUrl, headers) {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }
  async list(options = {}) {
    const params = new URLSearchParams;
    if (options.page)
      params.set("page", String(options.page));
    if (options.limit)
      params.set("limit", String(options.limit));
    const query = params.toString();
    const url = `${this.baseUrl}/media${query ? `?${query}` : ""}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`SDK: ${res.status} fetching media list`);
    }
    return res.json();
  }
  async get(id) {
    const res = await fetch(`${this.baseUrl}/media/${id}`, { headers: this.headers });
    if (res.status === 404)
      return null;
    if (!res.ok)
      throw new Error(`SDK: ${res.status} fetching media`);
    const body = await res.json();
    return body.data;
  }
}

// src/search.ts
class SearchClient {
  baseUrl;
  headers;
  constructor(baseUrl, headers) {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }
  async search(options) {
    const params = new URLSearchParams;
    params.set("q", options.q);
    if (options.collections)
      params.set("collections", options.collections.join(","));
    if (options.limit)
      params.set("limit", String(options.limit));
    if (options.page)
      params.set("page", String(options.page));
    const res = await fetch(`${this.baseUrl}/search?${params}`, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`SDK: ${res.status} searching`);
    }
    return res.json();
  }
  async searchCollection(collection, options) {
    const params = new URLSearchParams;
    params.set("q", options.q);
    if (options.filter)
      params.set("filter", options.filter);
    if (options.sort)
      params.set("sort", options.sort);
    if (options.limit)
      params.set("limit", String(options.limit));
    if (options.page)
      params.set("page", String(options.page));
    const res = await fetch(`${this.baseUrl}/search/${collection}?${params}`, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`SDK: ${res.status} searching ${collection}`);
    }
    return res.json();
  }
  async suggest(options) {
    const params = new URLSearchParams;
    params.set("q", options.q);
    if (options.collection)
      params.set("collection", options.collection);
    const res = await fetch(`${this.baseUrl}/search/suggest?${params}`, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`SDK: ${res.status} fetching suggestions`);
    }
    return res.json();
  }
}

// src/client.ts
class CMSClient {
  baseUrl;
  headers;
  media;
  search;
  constructor(options) {
    this.baseUrl = options.url.replace(/\/$/, "");
    this.headers = {};
    if (options.apiKey) {
      this.headers["Authorization"] = `Bearer ${options.apiKey}`;
    }
    if (options.previewToken) {
      this.headers["X-CMS-Preview"] = options.previewToken;
    }
    this.media = new MediaClient(this.baseUrl, this.headers);
    this.search = new SearchClient(this.baseUrl, this.headers);
  }
  collection(name) {
    return new CollectionClient(this.baseUrl, name, this.headers);
  }
}
export {
  SearchClient,
  MediaClient,
  CollectionClient,
  CMSClient
};
