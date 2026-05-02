export const collections = {
  page: [
    {
      title: 'About',
      slug: 'about',
      status: 'published',
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'I\'m a developer and designer building things for the web. This portfolio showcases my recent work.' }] }] },
    },
  ],
  project: [
    {
      title: 'Project Alpha',
      slug: 'project-alpha',
      status: 'published',
      excerpt: 'A web application built with modern tools.',
      tags: ['web', 'typescript', 'react'],
      featured: true,
      description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Project Alpha is a full-stack web application demonstrating modern development practices. Built with TypeScript, React, and PostgreSQL.' }] }] },
    },
    {
      title: 'Project Beta',
      slug: 'project-beta',
      status: 'published',
      excerpt: 'A design system and component library.',
      tags: ['design', 'css', 'components'],
      featured: true,
      description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Project Beta is a comprehensive design system with reusable components, documented patterns, and accessibility built in.' }] }] },
    },
  ],
  caseStudy: [
    {
      title: 'Redesigning the Dashboard',
      slug: 'redesigning-the-dashboard',
      status: 'published',
      client: 'Acme Corp',
      excerpt: 'How we improved the dashboard UX for a SaaS product.',
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A deep dive into the research, design, and implementation of a new dashboard experience that improved user engagement by 40%.' }] }] },
    },
  ],
  article: [],
}
