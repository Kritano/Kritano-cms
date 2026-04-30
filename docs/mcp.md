# MCP server

Kritano CMS includes an MCP (Model Context Protocol) server that lets Claude Desktop, Cursor, and any MCP-compatible AI client read and write your CMS content directly.

## What it enables

- Ask Claude: "What collections does my CMS have?" — gets the schema
- Ask Claude: "Create a draft article titled 'Hello World' with some body text" — creates the document
- Ask Claude: "List all published articles" — queries the API
- Ask Claude: "Publish the article about deployment" — publishes it

## Setup

### 1. Create an API key

In the CMS admin, create an API key with these scopes:
- `content:read`, `content:write`, `content:publish`
- `media:read`
- `schema:read`

### 2. Configure Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "my-cms": {
      "command": "bun",
      "args": ["run", "/path/to/your/cms/packages/cli/src/index.ts", "mcp"],
      "env": {
        "CMS_URL": "https://mysite.com",
        "CMS_API_KEY": "cms_live_your_api_key_here"
      }
    }
  }
}
```

### 3. Configure Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "my-cms": {
      "command": "bun",
      "args": ["run", "/path/to/your/cms/packages/cli/src/index.ts", "mcp"],
      "env": {
        "CMS_URL": "https://mysite.com",
        "CMS_API_KEY": "cms_live_your_api_key_here"
      }
    }
  }
}
```

## Available tools

### Schema

| Tool | Description |
|---|---|
| `cms_list_collections` | List all collections with endpoints and document counts |

### Content

| Tool | Description |
|---|---|
| `cms_find_documents` | Search and list documents with filtering, sorting, and pagination |
| `cms_get_document` | Get a single document by ID or slug |
| `cms_create_document` | Create a new draft document |
| `cms_update_document` | Update specific fields on a document |
| `cms_publish_document` | Publish a document |
| `cms_unpublish_document` | Revert a document to draft |
| `cms_delete_document` | Permanently delete a document |

### Media

| Tool | Description |
|---|---|
| `cms_list_media` | List media files with optional folder filter |
| `cms_get_media` | Get media details and usage information |

### Site

| Tool | Description |
|---|---|
| `cms_site_info` | Site health, URL, and available collections |

## Required API key scopes per tool

| Tool | Required scopes |
|---|---|
| `cms_list_collections` | `schema:read` or `content:read` |
| `cms_find_documents` | `content:read` |
| `cms_get_document` | `content:read` |
| `cms_create_document` | `content:write` |
| `cms_update_document` | `content:write` |
| `cms_publish_document` | `content:publish` |
| `cms_unpublish_document` | `content:publish` |
| `cms_delete_document` | `content:write` |
| `cms_list_media` | `media:read` |
| `cms_get_media` | `media:read` |
| `cms_site_info` | Any valid key |

## Example prompts

```
"What content types are available in my CMS?"
"Show me all draft articles"
"Create a new page called About Us with the slug about-us"
"Update the article with slug hello-world to change the title to Hello World!"
"Publish all draft articles"
"How many published pages do I have?"
```

## Troubleshooting

**"Error: CMS_URL environment variable is required"**
Set the `CMS_URL` in the env section of your MCP config.

**"Error: Invalid API key or CMS is unreachable"**
Check that the CMS API is running and the API key is valid. Test with:
```bash
curl https://mysite.com/api/health -H "Authorization: Bearer cms_live_..."
```

**Tools not appearing in Claude Desktop**
Restart Claude Desktop after changing the config. Check the MCP logs in the developer console.
