const crypto = require('crypto');
const { getAutomationFirestore } = require('../automation/admin-firestore');

const LISTING_COLLECTIONS = ['properties', 'marketplace'];
const PRIORITY_MARKETS = ['lagos', 'abuja', 'port harcourt'];
const MAX_JOB_ATTEMPTS = 3;
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const MARKET_TRENDS_TTL_MS = 6 * 60 * 60 * 1000;

function getDb() {
  return getAutomationFirestore();
}

function nowDate() {
  return new Date();
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIso(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `post-${Date.now()}`;
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function titleCase(value) {
  return normalizeText(value)
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function serializeDoc(doc) {
  if (!doc?.exists) return null;
  const data = doc.data() || {};
  return {
    id: doc.id,
    ...data,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    publishedAt: toIso(data.publishedAt),
    scheduledFor: toIso(data.scheduledFor),
    nextRunAt: toIso(data.nextRunAt),
    lockedAt: toIso(data.lockedAt),
    completedAt: toIso(data.completedAt),
    failedAt: toIso(data.failedAt),
    generatedAt: toIso(data.generatedAt)
  };
}

function parsePrice(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value || '').replace(/[,\s]/g, '').toLowerCase();
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)(m|million|k|thousand|bn|billion)?/i);
  if (!match) return null;
  let amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const suffix = match[2] || '';
  if (['m', 'million'].includes(suffix)) amount *= 1000000;
  if (['k', 'thousand'].includes(suffix)) amount *= 1000;
  if (['bn', 'billion'].includes(suffix)) amount *= 1000000000;
  return Math.round(amount);
}

function isActiveListing(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.isDeleted === true || data.deletedAt) return false;
  if (data.isActive === false) return false;
  const status = normalizeText(data.status).toLowerCase();
  return !['deleted', 'inactive', 'archived', 'rejected', 'removed'].includes(status);
}

function extractLocation(data) {
  return normalizeText(
    data.location ||
      data.city ||
      data.town ||
      data.area ||
      data.address?.city ||
      data.address?.town ||
      data.address?.area ||
      ''
  );
}

function extractState(data) {
  return normalizeText(data.state || data.region || data.address?.state || data.address?.region || '');
}

function extractCategory(data, collectionName) {
  return normalizeText(data.category || data.type || data.propertyType || data.listingType || collectionName);
}

function resolveAmount(data) {
  return parsePrice(data.price || data.rent || data.amount || data.monthlyRent || data.yearlyRent);
}

function formatNaira(amount) {
  if (!Number.isFinite(amount)) return null;
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => normalizeText(tag).toLowerCase()).filter(Boolean).slice(0, 8);
}

function normalizeUrl(value) {
  const url = String(value || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return '';
  try {
    return new URL(url).toString();
  } catch {
    return '';
  }
}

function sanitizeSourceReferences(sourceReferences) {
  if (!Array.isArray(sourceReferences)) return [];

  const seen = new Set();
  return sourceReferences
    .map((source) => {
      if (typeof source === 'string') {
        const url = normalizeUrl(source);
        return url ? { title: url.replace(/^https?:\/\//i, '').replace(/\/$/, ''), url, note: '' } : null;
      }

      const url = normalizeUrl(source?.url);
      if (!url) return null;
      return {
        title: normalizeText(source.title || source.name || url.replace(/^https?:\/\//i, '').replace(/\/$/, '')).slice(0, 120),
        url,
        note: normalizeText(source.note || source.description || '').slice(0, 180)
      };
    })
    .filter(Boolean)
    .filter((source) => {
      const key = source.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function defaultMarketSourceReference() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://nijahomzs.com').replace(/\/+$/, '');
  return {
    title: 'Nijahomzs Market Insights',
    url: `${appUrl}/market-insights`,
    note: 'Internal snapshot from active Nijahomzs listings.'
  };
}

function buildSourceReferencesForPrompt(sourceReferences = []) {
  const references = sanitizeSourceReferences(sourceReferences);
  const withDefault = references.length ? references : [defaultMarketSourceReference()];
  return withDefault
    .map((source, index) => `${index + 1}. ${source.title} - ${source.url}${source.note ? ` (${source.note})` : ''}`)
    .join('\n');
}

async function ensureUniqueSlug(db, baseSlug, existingPostId = null) {
  const root = slugify(baseSlug);
  let candidate = root;
  for (let i = 0; i < 20; i += 1) {
    const snap = await db.collection('blogPosts').where('slug', '==', candidate).limit(2).get();
    const conflict = snap.docs.find((doc) => doc.id !== existingPostId);
    if (!conflict) return candidate;
    candidate = `${root}-${i + 2}`;
  }
  return `${root}-${crypto.randomBytes(3).toString('hex')}`;
}

function parseGeminiJson(text) {
  const raw = String(text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not contain JSON.');
  }
  return JSON.parse(raw.slice(start, end + 1));
}

async function generateBlogDraft({ topic, promptType = 'property_guide', marketContext = [], sourceReferences = [] }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing.');

  const model = process.env.CONTENT_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contextText = marketContext.length
    ? marketContext.slice(0, 8).map((item) => `${item.location}, ${item.state}: ${item.count} active listings`).join('; ')
    : 'No cached trend context available yet.';
  const cleanedSources = sanitizeSourceReferences(sourceReferences);
  const promptSources = cleanedSources.length ? cleanedSources : [defaultMarketSourceReference()];

  const prompt = [
    'You are writing for Nijahomzs, a Nigerian property marketplace.',
    'Write human-sounding, helpful, SEO-friendly property content for Nigerian readers.',
    'Use practical Nigerian real estate context, avoid hype, and keep claims conservative.',
    'Use only the provided references and Nijahomzs market context for source-backed claims.',
    'Do not invent statistics, source names, or URLs.',
    'Return JSON only with: title, summary, metaDescription, bodyMarkdown, tags, socialSummary, sourceReferences.',
    'sourceReferences must be an array of {title, url, note} using the provided source URLs only.',
    'bodyMarkdown must use short paragraphs and markdown headings. Do not include unsafe HTML.',
    `Prompt type: ${promptType}`,
    `Topic: ${topic}`,
    `Market context: ${contextText}`,
    `References:\n${buildSourceReferencesForPrompt(promptSources)}`
  ].join('\n');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.65,
        topP: 0.9,
        maxOutputTokens: 1800,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Gemini content generation failed (${response.status}): ${detail.slice(0, 220)}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
  const parsed = parseGeminiJson(text);
  const title = normalizeText(parsed.title || topic).slice(0, 120);
  const bodyMarkdown = String(parsed.bodyMarkdown || parsed.body || '').trim();

  if (!title || bodyMarkdown.length < 300) {
    throw new Error('AI draft was too short or incomplete.');
  }

  return {
    title,
    slug: slugify(title),
    summary: normalizeText(parsed.summary).slice(0, 300),
    metaDescription: normalizeText(parsed.metaDescription || parsed.summary).slice(0, 160),
    bodyMarkdown,
    tags: normalizeTags(parsed.tags),
    socialSummary: normalizeText(parsed.socialSummary || parsed.summary).slice(0, 260),
    sourceReferences: sanitizeSourceReferences(parsed.sourceReferences).length
      ? sanitizeSourceReferences(parsed.sourceReferences)
      : promptSources
  };
}

async function listPublishedBlogPosts({ limit = 24 } = {}) {
  const db = getDb();
  const snap = await db.collection('blogPosts')
    .where('status', '==', 'published')
    .limit(100)
    .get();
  return snap.docs
    .map(serializeDoc)
    .sort((a, b) => (Date.parse(b.publishedAt || b.updatedAt || '') || 0) - (Date.parse(a.publishedAt || a.updatedAt || '') || 0))
    .slice(0, Math.max(1, Math.min(Number(limit) || 24, 100)));
}

async function getPublishedBlogPostBySlug(slug) {
  const db = getDb();
  const snap = await db.collection('blogPosts')
    .where('slug', '==', slugify(slug))
    .where('status', '==', 'published')
    .limit(1)
    .get();
  return snap.empty ? null : serializeDoc(snap.docs[0]);
}

async function listAdminContent({ limit = 50 } = {}) {
  const db = getDb();
  const [postsSnap, jobsSnap, socialSnap, trendDoc] = await Promise.all([
    db.collection('blogPosts').orderBy('updatedAt', 'desc').limit(limit).get(),
    db.collection('contentJobs').orderBy('createdAt', 'desc').limit(25).get(),
    db.collection('socialShareQueue').orderBy('createdAt', 'desc').limit(25).get(),
    db.collection('marketTrends').doc('latest').get()
  ]);

  return {
    posts: postsSnap.docs.map(serializeDoc),
    jobs: jobsSnap.docs.map(serializeDoc),
    socialQueue: socialSnap.docs.map(serializeDoc),
    trend: serializeDoc(trendDoc)
  };
}

async function createContentJob({ topic, promptType = 'property_guide', scheduledFor = null, createdBy = 'admin', sourceReferences = [] }) {
  const cleanTopic = normalizeText(topic);
  if (cleanTopic.length < 8) {
    const error = new Error('Topic must be at least 8 characters.');
    error.status = 400;
    throw error;
  }

  const db = getDb();
  const now = nowDate();
  const nextRunAt = toDate(scheduledFor) || now;
  const ref = db.collection('contentJobs').doc();
  await ref.set({
    topic: cleanTopic,
    promptType: normalizeText(promptType) || 'property_guide',
    status: 'pending',
    attempts: 0,
    sourceReferences: sanitizeSourceReferences(sourceReferences),
    nextRunAt,
    createdBy,
    createdAt: now,
    updatedAt: now
  });
  return serializeDoc(await ref.get());
}

async function updateBlogPost({ postId, updates = {}, actorId = 'admin' }) {
  if (!postId) {
    const error = new Error('postId is required.');
    error.status = 400;
    throw error;
  }

  const db = getDb();
  const ref = db.collection('blogPosts').doc(postId);
  const doc = await ref.get();
  if (!doc.exists) {
    const error = new Error('Blog post not found.');
    error.status = 404;
    throw error;
  }

  const current = doc.data() || {};
  const now = nowDate();
  const patch = { updatedAt: now, updatedBy: actorId };

  if (Object.prototype.hasOwnProperty.call(updates, 'title')) patch.title = normalizeText(updates.title).slice(0, 140);
  if (Object.prototype.hasOwnProperty.call(updates, 'summary')) patch.summary = normalizeText(updates.summary).slice(0, 320);
  if (Object.prototype.hasOwnProperty.call(updates, 'metaDescription')) patch.metaDescription = normalizeText(updates.metaDescription).slice(0, 170);
  if (Object.prototype.hasOwnProperty.call(updates, 'bodyMarkdown')) patch.bodyMarkdown = String(updates.bodyMarkdown || '').trim();
  if (Object.prototype.hasOwnProperty.call(updates, 'tags')) patch.tags = normalizeTags(updates.tags);
  if (Object.prototype.hasOwnProperty.call(updates, 'sourceReferences')) {
    patch.sourceReferences = sanitizeSourceReferences(updates.sourceReferences);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
    const status = normalizeText(updates.status).toLowerCase();
    if (!['draft', 'review', 'scheduled', 'published', 'rejected'].includes(status)) {
      const error = new Error('Invalid blog status.');
      error.status = 400;
      throw error;
    }
    patch.status = status;
    if (status === 'published') patch.publishedAt = now;
    if (status === 'scheduled') patch.scheduledFor = toDate(updates.scheduledFor) || toDate(current.scheduledFor) || now;
    if (status === 'rejected') patch.rejectionReason = normalizeText(updates.rejectionReason).slice(0, 300);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'slug')) {
    patch.slug = await ensureUniqueSlug(db, updates.slug || patch.title || current.title, postId);
  } else if (patch.title && patch.title !== current.title) {
    patch.slug = await ensureUniqueSlug(db, current.slug || patch.title, postId);
  }

  await ref.set(patch, { merge: true });
  return serializeDoc(await ref.get());
}

async function collectMarketTrendData() {
  const db = getDb();
  const counts = new Map();
  const categoryCounts = new Map();
  const totals = { totalActiveListings: 0, byCollection: {} };

  const snapshots = await Promise.all(LISTING_COLLECTIONS.map((collection) => db.collection(collection).get()));
  snapshots.forEach((snapshot, index) => {
    const collectionName = LISTING_COLLECTIONS[index];
    let activeInCollection = 0;

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      if (!isActiveListing(data)) return;

      const state = extractState(data) || 'Unknown';
      const location = extractLocation(data) || 'Unknown';
      const category = extractCategory(data, collectionName) || collectionName;
      const amount = resolveAmount(data);
      const key = `${state.toLowerCase()}::${location.toLowerCase()}`;
      const existing = counts.get(key) || {
        state: titleCase(state),
        location: titleCase(location),
        count: 0,
        prices: [],
        categories: {}
      };

      existing.count += 1;
      if (amount) existing.prices.push(amount);
      existing.categories[category] = (existing.categories[category] || 0) + 1;
      counts.set(key, existing);

      const catKey = category.toLowerCase();
      categoryCounts.set(catKey, {
        category: titleCase(category),
        count: (categoryCounts.get(catKey)?.count || 0) + 1
      });

      activeInCollection += 1;
      totals.totalActiveListings += 1;
    });

    totals.byCollection[collectionName] = activeInCollection;
  });

  const locations = Array.from(counts.values()).map((item) => {
    const prices = item.prices.filter(Number.isFinite).sort((a, b) => a - b);
    const sum = prices.reduce((total, value) => total + value, 0);
    return {
      state: item.state,
      location: item.location,
      count: item.count,
      averagePrice: prices.length ? Math.round(sum / prices.length) : null,
      minPrice: prices.length ? prices[0] : null,
      maxPrice: prices.length ? prices[prices.length - 1] : null,
      averagePriceLabel: prices.length ? formatNaira(sum / prices.length) : null,
      minPriceLabel: prices.length ? formatNaira(prices[0]) : null,
      maxPriceLabel: prices.length ? formatNaira(prices[prices.length - 1]) : null,
      topCategories: Object.entries(item.categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([category, count]) => ({ category: titleCase(category), count }))
    };
  }).sort((a, b) => b.count - a.count);

  return {
    totals,
    locations,
    priorityMarkets: locations
      .filter((item) => PRIORITY_MARKETS.some((market) => `${item.location} ${item.state}`.toLowerCase().includes(market)))
      .slice(0, 12),
    topCategories: Array.from(categoryCounts.values()).sort((a, b) => b.count - a.count).slice(0, 10),
    generatedAt: nowDate(),
    sourceCollections: LISTING_COLLECTIONS
  };
}

async function refreshMarketTrends({ dryRun = false } = {}) {
  const trend = await collectMarketTrendData();
  if (dryRun) return { dryRun: true, trend };
  const db = getDb();
  await db.collection('marketTrends').doc('latest').set({ ...trend, updatedAt: nowDate() }, { merge: true });
  return { dryRun: false, trend };
}

async function getLatestMarketTrends({ allowRefresh = false } = {}) {
  const db = getDb();
  const ref = db.collection('marketTrends').doc('latest');
  const doc = await ref.get();
  const trend = serializeDoc(doc);
  const generatedAt = toDate(trend?.generatedAt);
  const stale = !generatedAt || (Date.now() - generatedAt.getTime()) > MARKET_TRENDS_TTL_MS;
  if ((!trend || stale) && allowRefresh) {
    const refreshed = await refreshMarketTrends();
    return {
      ...refreshed.trend,
      generatedAt: toIso(refreshed.trend.generatedAt),
      updatedAt: toIso(nowDate())
    };
  }
  return trend;
}

async function getMarketContextForPrompt() {
  const trend = await getLatestMarketTrends({ allowRefresh: true }).catch(() => null);
  return trend?.locations || trend?.trend?.locations || [];
}

async function lockNextContentJob(db) {
  const now = nowDate();
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);

  const pendingSnap = await db.collection('contentJobs')
    .where('status', '==', 'pending')
    .limit(25)
    .get();

  let candidates = pendingSnap.docs.filter((doc) => {
    const data = doc.data() || {};
    return (data.attempts || 0) < MAX_JOB_ATTEMPTS && (!toDate(data.nextRunAt) || toDate(data.nextRunAt) <= now);
  }).sort((a, b) => (toDate(a.data()?.nextRunAt)?.getTime() || 0) - (toDate(b.data()?.nextRunAt)?.getTime() || 0));

  if (!candidates.length) {
    const staleSnap = await db.collection('contentJobs')
      .where('status', '==', 'processing')
      .limit(25)
      .get();
    candidates = staleSnap.docs.filter((doc) => {
      const lockedAt = toDate(doc.data()?.lockedAt);
      return lockedAt && lockedAt <= staleBefore;
    }).slice(0, 5);
  }

  if (!candidates.length) return null;
  const ref = candidates[0].ref;

  return db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(ref);
    if (!fresh.exists) return null;
    const data = fresh.data() || {};
    const attempts = Number(data.attempts || 0);
    const lockedAt = toDate(data.lockedAt);
    const isPendingDue = data.status === 'pending' && (!toDate(data.nextRunAt) || toDate(data.nextRunAt) <= now);
    const isStale = data.status === 'processing' && lockedAt && lockedAt <= staleBefore;
    if ((!isPendingDue && !isStale) || attempts >= MAX_JOB_ATTEMPTS) return null;

    transaction.update(ref, {
      status: 'processing',
      lockedAt: now,
      attempts: attempts + 1,
      updatedAt: now
    });

    return { id: fresh.id, ref, data: { ...data, attempts: attempts + 1 } };
  });
}

async function processNextContentJob({ dryRun = false } = {}) {
  const db = getDb();
  const job = await lockNextContentJob(db);
  if (!job) return { processed: false, reason: 'no_due_job' };

  try {
    const marketContext = await getMarketContextForPrompt();
    const draft = await generateBlogDraft({
      topic: job.data.topic,
      promptType: job.data.promptType,
      marketContext,
      sourceReferences: job.data.sourceReferences || []
    });

    const now = nowDate();
    const slug = await ensureUniqueSlug(db, draft.slug || draft.title);
    const postRef = db.collection('blogPosts').doc();
    const postData = {
      ...draft,
      slug,
      topic: job.data.topic,
      promptType: job.data.promptType || 'property_guide',
      sourceJobId: job.id,
      status: 'draft',
      authorType: 'ai_assisted',
      sourceReferences: sanitizeSourceReferences(draft.sourceReferences || job.data.sourceReferences || []),
      createdBy: job.data.createdBy || 'system',
      createdAt: now,
      updatedAt: now
    };

    if (!dryRun) {
      await postRef.set(postData);
      await job.ref.update({
        status: 'completed',
        blogPostId: postRef.id,
        completedAt: now,
        updatedAt: now,
        lastError: null
      });
    } else {
      await job.ref.update({ status: 'pending', lockedAt: null, updatedAt: now });
    }

    return { processed: true, type: 'content_job', jobId: job.id, postId: dryRun ? null : postRef.id, draft, dryRun };
  } catch (error) {
    const now = nowDate();
    const attempts = Number(job.data.attempts || 1);
    const exhausted = attempts >= MAX_JOB_ATTEMPTS;
    await job.ref.update({
      status: exhausted ? 'failed' : 'pending',
      lockedAt: null,
      lastError: error.message,
      failedAt: exhausted ? now : null,
      nextRunAt: new Date(now.getTime() + Math.min(60, attempts * 15) * 60 * 1000),
      updatedAt: now
    });
    return { processed: true, type: 'content_job_failed', jobId: job.id, failed: true, error: error.message, exhausted };
  }
}

function configuredSocialChannels() {
  return [
    { platform: 'facebook', channelId: process.env.BUFFER_FACEBOOK_CHANNEL_ID },
    { platform: 'instagram', channelId: process.env.BUFFER_INSTAGRAM_CHANNEL_ID },
    { platform: 'x', channelId: process.env.BUFFER_X_CHANNEL_ID || process.env.BUFFER_TWITTER_CHANNEL_ID }
  ].filter((item) => item.channelId);
}

function socialTextForPost(post) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://nijahomzs.com').replace(/\/+$/, '');
  const url = `${appUrl}/blog/${post.slug}`;
  const base = normalizeText(post.socialSummary || post.summary || post.title).slice(0, 220);
  return `${base}\n\nRead more: ${url}`;
}

async function queueSocialSharesForPost({ postId, scheduledFor = null, actorId = 'admin' }) {
  const db = getDb();
  const postRef = db.collection('blogPosts').doc(postId);
  const postDoc = await postRef.get();
  if (!postDoc.exists) {
    const error = new Error('Blog post not found.');
    error.status = 404;
    throw error;
  }

  const post = postDoc.data() || {};
  if (post.status !== 'published' && post.status !== 'scheduled') {
    const error = new Error('Only published or scheduled posts can be queued for social sharing.');
    error.status = 400;
    throw error;
  }

  const channels = configuredSocialChannels();
  const now = nowDate();
  const dueAt = toDate(scheduledFor) || toDate(post.scheduledFor) || now;
  const text = socialTextForPost(post);
  const queued = [];

  await Promise.all(channels.map(async (channel) => {
    const docId = `${postId}_${channel.platform}`;
    const ref = db.collection('socialShareQueue').doc(docId);
    const existing = await ref.get();
    if (existing.exists) {
      queued.push(serializeDoc(existing));
      return;
    }

    await ref.set({
      postId,
      platform: channel.platform,
      channelId: channel.channelId,
      text,
      status: 'pending',
      attempts: 0,
      scheduledFor: dueAt,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now
    });
    queued.push(serializeDoc(await ref.get()));
  }));

  await postRef.set({ socialQueued: queued.length > 0, updatedAt: now }, { merge: true });
  return queued;
}

async function sendBufferPost({ channelId, text, scheduledFor, dryRun = false }) {
  if (dryRun) return { dryRun: true, id: 'dry-run-buffer-post' };
  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) throw new Error('BUFFER_API_KEY is missing.');

  const endpoint = process.env.BUFFER_API_URL || 'https://graph.buffer.com/';
  const scheduledAt = toDate(scheduledFor);
  const mutation = 'mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { post { id status } } }';
  const input = {
    channelIds: [channelId],
    text,
    schedulingType: scheduledAt && scheduledAt > nowDate() ? 'scheduled' : 'now'
  };
  if (scheduledAt && scheduledAt > nowDate()) input.scheduledAt = scheduledAt.toISOString();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ query: mutation, variables: { input } })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message || `Buffer API failed (${response.status})`);
  }

  return payload.data?.createPost?.post || payload.data?.createPost || payload;
}

async function lockNextSocialShare(db) {
  const now = nowDate();
  const snap = await db.collection('socialShareQueue')
    .where('status', '==', 'pending')
    .limit(25)
    .get();
  const doc = snap.docs.sort((a, b) => {
    return (toDate(a.data()?.scheduledFor)?.getTime() || 0) - (toDate(b.data()?.scheduledFor)?.getTime() || 0);
  }).find((item) => {
    const data = item.data() || {};
    return (data.attempts || 0) < MAX_JOB_ATTEMPTS && (!toDate(data.scheduledFor) || toDate(data.scheduledFor) <= now);
  });
  if (!doc) return null;

  return db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(doc.ref);
    if (!fresh.exists) return null;
    const data = fresh.data() || {};
    if (data.status !== 'pending' || (toDate(data.scheduledFor) && toDate(data.scheduledFor) > now)) return null;
    const attempts = Number(data.attempts || 0);
    if (attempts >= MAX_JOB_ATTEMPTS) return null;
    transaction.update(doc.ref, { status: 'processing', attempts: attempts + 1, lockedAt: now, updatedAt: now });
    return { id: fresh.id, ref: doc.ref, data: { ...data, attempts: attempts + 1 } };
  });
}

async function processNextSocialShare({ dryRun = false } = {}) {
  const db = getDb();
  const item = await lockNextSocialShare(db);
  if (!item) return { processed: false, reason: 'no_due_social_share' };
  const now = nowDate();

  try {
    const result = await sendBufferPost({
      channelId: item.data.channelId,
      text: item.data.text,
      scheduledFor: item.data.scheduledFor,
      dryRun
    });

    await item.ref.update({
      status: dryRun ? 'pending' : 'sent',
      lockedAt: null,
      sentAt: dryRun ? null : now,
      bufferPostId: result.id || null,
      bufferStatus: result.status || null,
      updatedAt: now
    });

    if (!dryRun) {
      await db.collection('socialShareLogs').add({
        queueId: item.id,
        postId: item.data.postId,
        platform: item.data.platform,
        channelId: item.data.channelId,
        status: 'sent',
        bufferResponse: result,
        createdAt: now
      });
    }

    return { processed: true, type: 'social_share', queueId: item.id, platform: item.data.platform, dryRun, sent: !dryRun };
  } catch (error) {
    const exhausted = Number(item.data.attempts || 1) >= MAX_JOB_ATTEMPTS;
    await item.ref.update({
      status: exhausted ? 'failed' : 'pending',
      lockedAt: null,
      lastError: error.message,
      failedAt: exhausted ? now : null,
      scheduledFor: new Date(now.getTime() + 30 * 60 * 1000),
      updatedAt: now
    });
    await db.collection('socialShareLogs').add({
      queueId: item.id,
      postId: item.data.postId,
      platform: item.data.platform,
      channelId: item.data.channelId,
      status: 'failed',
      error: error.message,
      createdAt: now
    });
    return { processed: true, type: 'social_share_failed', queueId: item.id, failed: true, error: error.message, exhausted };
  }
}

module.exports = {
  createContentJob,
  updateBlogPost,
  listAdminContent,
  listPublishedBlogPosts,
  getPublishedBlogPostBySlug,
  refreshMarketTrends,
  getLatestMarketTrends,
  processNextContentJob,
  processNextSocialShare,
  queueSocialSharesForPost,
  slugify,
  stripHtml
};
