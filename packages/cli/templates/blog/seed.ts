export const collections = {
  category: [
    { title: 'Technology', slug: 'technology', description: 'Posts about tech and development', status: 'published' },
    { title: 'Design', slug: 'design', description: 'Posts about design and creativity', status: 'published' },
  ],
  author: [
    { name: 'Admin', slug: 'admin', bio: 'Site administrator and author.', status: 'published' },
  ],
  page: [
    {
      title: 'About',
      slug: 'about',
      status: 'published',
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Welcome to our blog. We write about technology, design, and ideas that matter.' }] }] },
    },
  ],
  article: [
    {
      title: 'Welcome to the Blog',
      slug: 'welcome',
      status: 'published',
      excerpt: 'Your first blog post. Edit or replace it from the admin.',
      tags: ['welcome', 'getting-started'],
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This is your first blog post. Head to the admin to edit it, add images, and make it your own.' }] }] },
    },
    {
      title: 'Building with Kritano CMS',
      slug: 'building-with-kritano',
      status: 'published',
      excerpt: 'A quick tour of what you can do with Kritano CMS.',
      tags: ['kritano', 'cms', 'technology'],
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Kritano CMS gives you a schema-first content model, a rich text editor, and a zero-JS frontend. This post explores the basics.' }] }] },
    },
    {
      title: 'Design Principles',
      slug: 'design-principles',
      status: 'draft',
      excerpt: 'Our approach to design.',
      tags: ['design'],
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A draft post about design principles. Publish it when you are ready.' }] }] },
    },
  ],
}
