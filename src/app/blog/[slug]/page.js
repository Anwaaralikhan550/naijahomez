import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getEngine() {
  const engineModule = await import('@/lib/content/content-engine');
  return engineModule.default || engineModule;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const engine = await getEngine();
  const post = await engine.getPublishedBlogPostBySlug(slug).catch(() => null);
  if (!post) {
    return {
      title: 'Blog Post Not Found - Nijahomzs'
    };
  }

  return {
    title: `${post.title} - Nijahomzs Blog`,
    description: post.metaDescription || post.summary,
    alternates: {
      canonical: `/blog/${post.slug}`
    },
    openGraph: {
      title: post.title,
      description: post.metaDescription || post.summary,
      url: `/blog/${post.slug}`,
      siteName: 'Nijahomzs'
    }
  };
}

function formatDate(value) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat('en-NG', { dateStyle: 'long' }).format(new Date(value));
  } catch {
    return null;
  }
}

function renderMarkdown(body) {
  return String(body || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      if (block.startsWith('### ')) {
        return <h3 key={index} className="mt-8 text-2xl font-bold text-blue-950">{block.slice(4)}</h3>;
      }
      if (block.startsWith('## ')) {
        return <h2 key={index} className="mt-10 text-3xl font-bold text-blue-950">{block.slice(3)}</h2>;
      }
      if (block.startsWith('# ')) {
        return <h2 key={index} className="mt-10 text-3xl font-bold text-blue-950">{block.slice(2)}</h2>;
      }
      if (block.startsWith('- ')) {
        const items = block.split('\n').map((item) => item.replace(/^-\s*/, '').trim()).filter(Boolean);
        return (
          <ul key={index} className="mt-5 list-disc space-y-2 pl-6 text-gray-700">
            {items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        );
      }
      return <p key={index} className="mt-5 text-lg leading-8 text-gray-700">{block}</p>;
    });
}

export default async function BlogDetailPage({ params }) {
  const { slug } = await params;
  const engine = await getEngine();
  const post = await engine.getPublishedBlogPostBySlug(slug).catch(() => null);
  if (!post) notFound();
  const sourceReferences = Array.isArray(post.sourceReferences) ? post.sourceReferences : [];

  return (
    <article className="min-h-screen bg-white">
      <header className="bg-gradient-to-b from-blue-50 to-white">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <Link href="/blog" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Back to blog</Link>
          <p className="mt-6 text-sm font-medium text-amber-700">{formatDate(post.publishedAt) || 'Nijahomzs guide'}</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-blue-950 md:text-5xl">{post.title}</h1>
          <p className="mt-5 text-xl leading-8 text-gray-600">{post.summary}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {(post.tags || []).map((tag) => (
              <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-blue-100">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
        {renderMarkdown(post.bodyMarkdown)}
        {sourceReferences.length > 0 && (
          <section className="mt-12 rounded-2xl border border-blue-100 bg-blue-50/60 p-6">
            <h2 className="text-xl font-bold text-blue-950">Sources and references</h2>
            <div className="mt-4 space-y-3">
              {sourceReferences.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-blue-100 bg-white p-4 text-sm transition hover:border-blue-300 hover:shadow-sm"
                >
                  <span className="font-semibold text-blue-800">{source.title || source.url}</span>
                  {source.note && <span className="mt-1 block text-gray-600">{source.note}</span>}
                  <span className="mt-1 block break-all text-xs text-gray-500">{source.url}</span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
