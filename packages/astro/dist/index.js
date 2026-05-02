// @bun
// ../sdk/dist/index.js
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
}

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

class CMSClient {
  baseUrl;
  headers;
  media;
  constructor(options) {
    this.baseUrl = options.url.replace(/\/$/, "");
    this.headers = {};
    if (options.apiKey) {
      this.headers["Authorization"] = `Bearer ${options.apiKey}`;
    }
    this.media = new MediaClient(this.baseUrl, this.headers);
  }
  collection(name) {
    return new CollectionClient(this.baseUrl, name, this.headers);
  }
}

// src/runtime.ts
var _client = null;
function getCMSClient() {
  if (!_client) {
    const url = process.env.CMS_API_URL || "http://localhost:3000/api";
    _client = new CMSClient({ url });
  }
  return _client;
}
function useCMS(props) {
  return {
    doc: props.doc || {},
    settings: props.settings || {},
    collection: props.collection || ""
  };
}
function defineTheme(config) {
  return config;
}
// src/integration.ts
function cmsIntegration(_options = {}) {
  return {
    name: "@cms/astro",
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {}
    }
  };
}
export {
  useCMS,
  getCMSClient,
  defineTheme,
  cmsIntegration
};
