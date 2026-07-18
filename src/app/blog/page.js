export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nijahomzs Blog - Property Guides & Market Tips',
  description: 'Read practical Nigerian property guides, market tips, and home search insights from Nijahomzs.'
};

async function getEngine() {
  const engineModule = await import('@/lib/content/content-engine');
  return engineModule.default || engineModule;
}

function formatDate(value) {
  if (!value) return 'Recently updated';
  try {
    return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return 'Recently updated';
  }
}

export default async function BlogPage() {
  const engine = await getEngine();
  const posts = await engine.listPublishedBlogPosts({ limit: 24 }).catch(() => []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white">
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 ring-1 ring-amber-200">
            Nijahomzs Insights
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-blue-950 md:text-5xl">
            Property guides for smarter Nigerian home decisions
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Practical tips, location notes, and market explainers reviewed by the Nijahomzs team.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-blue-100 bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-gray-900">No published posts yet.</p>
            <p className="mt-2 text-gray-600">Approved property guides will appear here automatically.</p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <a
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
              >
                <p className="text-sm font-medium text-blue-600">{formatDate(post.publishedAt)}</p>
                <h2 className="mt-3 line-clamp-2 text-xl font-bold text-blue-950 group-hover:text-blue-700">
                  {post.title}
                </h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">{post.summary}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {(post.tags || []).slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
