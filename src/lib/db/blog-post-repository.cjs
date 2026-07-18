const crypto = require('crypto');
const { query } = require('./postgres-client.cjs');

const DIACRITIC_PATTERN = new RegExp(
  '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']',
  'g'
);

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(DIACRITIC_PATTERN, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `post-${Date.now()}`;
}

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function rowToPost(row) {
  if (!row) return null;
  const data = row.data || {};
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    bodyMarkdown: row.body,
    status: row.status,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    ...data,
    publishedAt: toIso(row.published_at),
    scheduledFor: toIso(row.scheduled_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function ensureUniqueSlug(baseSlug, excludeId = null) {
  const root = slugify(baseSlug);
  for (let i = 0; i < 20; i += 1) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const result = await query(
      `SELECT id FROM blog_posts WHERE slug = $1 AND id IS DISTINCT FROM $2 LIMIT 1`,
      [candidate, excludeId]
    );
    if (result.rows.length === 0) return candidate;
  }
  return `${root}-${crypto.randomBytes(3).toString('hex')}`;
}

async function createBlogPost(post) {
  const {
    slug, title, summary = null, bodyMarkdown = '', status = 'draft',
    metaDescription = null, publishedAt = null, scheduledFor = null,
    ...rest
  } = post;

  const result = await query(
    `INSERT INTO blog_posts (slug, title, summary, body, status, meta_description, published_at, scheduled_at, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING *`,
    [slug, title, summary, bodyMarkdown, status, metaDescription, publishedAt, scheduledFor, JSON.stringify(rest)]
  );
  return rowToPost(result.rows[0]);
}

async function getBlogPostById(id) {
  const result = await query(`SELECT * FROM blog_posts WHERE id = $1`, [id]);
  return rowToPost(result.rows[0]);
}

async function getPublishedBlogPostBySlug(slug) {
  const result = await query(
    `SELECT * FROM blog_posts WHERE slug = $1 AND status = 'published' LIMIT 1`,
    [slugify(slug)]
  );
  return rowToPost(result.rows[0]);
}

async function listPublishedBlogPosts({ limit = 24 } = {}) {
  const result = await query(
    `SELECT * FROM blog_posts WHERE status = 'published'
     ORDER BY COALESCE(published_at, updated_at) DESC LIMIT $1`,
    [Math.min(Math.max(Number(limit) || 24, 1), 100)]
  );
  return result.rows.map(rowToPost);
}

async function listRecentBlogPosts({ limit = 50 } = {}) {
  const result = await query(
    `SELECT * FROM blog_posts ORDER BY updated_at DESC LIMIT $1`,
    [Math.min(Math.max(Number(limit) || 50, 1), 200)]
  );
  return result.rows.map(rowToPost);
}

async function updateBlogPost(id, patch) {
  const current = await getBlogPostById(id);
  if (!current) return null;

  const typedColumns = { slug: 'slug', title: 'title', summary: 'summary', bodyMarkdown: 'body', status: 'status', metaDescription: 'meta_description', publishedAt: 'published_at', scheduledFor: 'scheduled_at' };
  const sets = [];
  const params = [];
  const extraData = {};

  Object.entries(patch).forEach(([key, value]) => {
    if (typedColumns[key]) {
      params.push(value);
      sets.push(`${typedColumns[key]} = $${params.length}`);
    } else {
      extraData[key] = value;
    }
  });

  if (Object.keys(extraData).length > 0) {
    params.push(JSON.stringify(extraData));
    sets.push(`data = data || $${params.length}::jsonb`);
  }

  sets.push('updated_at = NOW()');
  params.push(id);

  const result = await query(
    `UPDATE blog_posts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rowToPost(result.rows[0]);
}

module.exports = {
  slugify,
  ensureUniqueSlug,
  createBlogPost,
  getBlogPostById,
  getPublishedBlogPostBySlug,
  listPublishedBlogPosts,
  listRecentBlogPosts,
  updateBlogPost,
  rowToPost
};
