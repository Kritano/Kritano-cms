// Seed data for the default starter
export const collections = {
  page: [
    {
      title: 'Home',
      slug: 'home',
      status: 'published',
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Welcome to your new site. Edit this page in the admin.' }] }] },
    },
    {
      title: 'About',
      slug: 'about',
      status: 'published',
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tell your story here.' }] }] },
    },
  ],
  article: [
    {
      title: 'Getting Started',
      slug: 'getting-started',
      status: 'published',
      excerpt: 'Your first article. Edit or delete this from the admin.',
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This is a sample article to get you started. Open the admin at /admin to edit it.' }] }] },
    },
    {
      title: 'Hello World',
      slug: 'hello-world',
      status: 'draft',
      excerpt: 'A draft article to show how drafts work.',
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This article is a draft — it won\'t appear on the public site until you publish it.' }] }] },
    },
  ],
}
