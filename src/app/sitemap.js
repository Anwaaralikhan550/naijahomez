export default async function sitemap() {
  const baseUrl = 'https://nijahomzs.com';
  let blogUrls = [];

  try {
    const engineModule = await import('@/lib/content/content-engine');
    const engine = engineModule.default || engineModule;
    const posts = await engine.listPublishedBlogPosts({ limit: 100 });
    blogUrls = posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.updatedAt || post.publishedAt || new Date().toISOString(),
      changeFrequency: 'weekly',
      priority: 0.7
    }));
  } catch {
    blogUrls = [];
  }

  return [
    { url: baseUrl, lastModified: new Date().toISOString(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/property`, lastModified: new Date().toISOString(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/marketplace`, lastModified: new Date().toISOString(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date().toISOString(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/market-insights`, lastModified: new Date().toISOString(), changeFrequency: 'daily', priority: 0.8 },
    ...blogUrls
  ];
}
