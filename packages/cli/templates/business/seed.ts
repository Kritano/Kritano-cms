export const collections = {
  page: [
    {
      title: 'Home',
      slug: 'home',
      status: 'published',
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Welcome to our business. We help companies grow with modern solutions.' }] }] },
    },
    {
      title: 'Contact',
      slug: 'contact',
      status: 'published',
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Get in touch with us. Fill out the form below or email us directly.' }] }] },
    },
  ],
  service: [
    {
      title: 'Web Development',
      slug: 'web-development',
      status: 'published',
      excerpt: 'Custom websites and web applications built for performance.',
      description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'We build fast, accessible websites using modern frameworks. From simple marketing sites to complex web applications.' }] }] },
    },
    {
      title: 'Design',
      slug: 'design',
      status: 'published',
      excerpt: 'Brand identity, UI/UX, and design systems.',
      description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Our design team creates cohesive brand experiences. From logos and brand guidelines to full UI/UX design for digital products.' }] }] },
    },
  ],
  teamMember: [
    { name: 'Alex Johnson', slug: 'alex-johnson', role: 'Founder & CEO', bio: 'Alex founded the company in 2020 with a vision to make quality tech accessible.', status: 'published' },
    { name: 'Sam Rivera', slug: 'sam-rivera', role: 'Lead Developer', bio: 'Sam leads our development team, specialising in TypeScript and systems architecture.', status: 'published' },
    { name: 'Jordan Lee', slug: 'jordan-lee', role: 'Head of Design', bio: 'Jordan brings 10 years of design experience, with a focus on accessibility and user research.', status: 'published' },
  ],
  testimonial: [
    { quote: 'Working with this team transformed our online presence. Our conversion rate doubled within three months.', author: 'Chris Taylor', role: 'Marketing Director', company: 'GrowthCo', status: 'published' },
    { quote: 'The redesign was exactly what we needed. Professional, fast, and they truly understood our audience.', author: 'Morgan Chen', role: 'CEO', company: 'StartupXYZ', status: 'published' },
  ],
  article: [
    {
      title: 'Why We Built This',
      slug: 'why-we-built-this',
      status: 'published',
      excerpt: 'The story behind our company and what drives us.',
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Every company starts with a problem. Ours was simple: too many businesses were stuck with outdated websites that didn\'t serve their customers.' }] }] },
    },
  ],
}
