export const dynamic = 'force-dynamic';
﻿import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth-middleware';
import scrapersModule from '@/lib/scrapers';
import scraperImportServiceModule from '@/lib/scrapers/scraper-import-service';

const scrapers = scrapersModule?.default || scrapersModule;
const { runScraper, getCanonicalSource, getSupportedSources } = scrapers;
const scraperImportService = scraperImportServiceModule?.default || scraperImportServiceModule;
const SOURCE_TAG_MAP = {
  'nigeria-property-centre': 'NPC',
  jiji: 'Jiji',
  locanto: 'Locanto'
};

const MARKETPLACE_CATEGORIES = new Set(['marketplace', 'phones', 'electronics', 'cars']);
const PROPERTY_CATEGORIES = new Set(['property', 'housemates', 'shared-housing', 'shared-housing-roommates']);

const errorResponse = (message, code, status = 500) =>
  NextResponse.json({ success: false, error: message, code }, { status });

const authErrorResponse = async (authError) => {
  const status = authError?.status || 401;
  const payload = await authError?.clone?.().json?.().catch(() => ({}));
  const message = payload?.error || 'Authentication required';
  const code = status === 403 ? 'FORBIDDEN' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'UNAUTHORIZED';
  return errorResponse(message, code, status);
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeCategory(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return '';
  if (normalized === 'classified') return 'noticeboard';
  if (normalized === 'shared') return 'shared-housing';
  if (normalized === 'flatmates') return 'housemates';
  if (normalized === 'mobile-phones' || normalized === 'phone') return 'phones';
  return normalized;
}

function parseLimit(value) {
  if (value === undefined || value === null || value === '') return 100;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, 500);
}

function resolveCollectionName(category) {
  if (MARKETPLACE_CATEGORIES.has(category)) return 'marketplace';
  if (PROPERTY_CATEGORIES.has(category)) return 'properties';
  if (category === 'noticeboard') return 'noticeboard';
  return null;
}

function buildFallbackKey(item) {
  const source = normalizeText(item.source).toLowerCase();
  const title = normalizeText(item.title).toLowerCase();
  const location = normalizeText(item.location).toLowerCase();
  const postedAt = normalizeText(item.postedAt);
  return `${source}|${title}|${location}|${postedAt}`;
}

function safeDate(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function parsePriceNumeric(price, priceNumeric) {
  const numeric = Number(priceNumeric);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  const parsed = parseFloat(String(price || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeImageUrls(imageUrls) {
  const values = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function isUsablePrice(priceNumeric) {
  return Number.isFinite(priceNumeric) && priceNumeric > 1;
}

function sanitizeForFirestore(input) {
  const cleaned = {};
  Object.entries(input || {}).forEach(([key, value]) => {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  });
  return cleaned;
}

async function docExistsByField(collectionRef, field, value) {
  if (!value) return false;
  const snapshot = await collectionRef.where(field, '==', value).limit(1).get();
  return !snapshot.empty;
}

function enrichItem(rawItem, category, canonicalSource, now = new Date()) {
  const item = rawItem || {};
  const title = normalizeText(item.title);
  const description = normalizeText(item.description) || title;
  const sourceUrl = normalizeText(item.sourceUrl);
  const price = normalizeText(item.price);
  const priceNumeric = parsePriceNumeric(price, item.priceNumeric);
  const imageUrls = normalizeImageUrls(item.imageUrls);

  if (!title || !sourceUrl || !imageUrls.length || !isUsablePrice(priceNumeric)) {
    return null;
  }

  const sourceTag = SOURCE_TAG_MAP[canonicalSource] || normalizeText(item.source) || canonicalSource;
  const createdAt = safeDate(item.createdAt, now);
  const updatedAt = safeDate(item.updatedAt, now);
  const postedAt = safeDate(item.postedAt, now);

  return sanitizeForFirestore({
    title,
    description,
    price: price || 'Price on request',
    priceNumeric,
    imageUrls,
    location: normalizeText(item.location) || 'Nigeria',
    source: sourceTag,
    category,
    sourceUrl,
    postedAt,
    createdAt,
    updatedAt,
    status: 'pending-review',
    isScraped: true,
    dataSource: 'scraped',
    titleLower: title.toLowerCase(),
    locationLower: normalizeText(item.location).toLowerCase()
  });
}

async function saveScrapedItems(db, collectionName, scrapedItems, category, canonicalSource) {
  const collectionRef = db.collection(collectionName);
  const now = new Date();

  const localSeen = new Set();
  const toInsert = [];

  for (const rawItem of scrapedItems) {
    const enriched = enrichItem(rawItem, category, canonicalSource, now);
    if (!enriched) {
      continue;
    }

    const fallbackKey = buildFallbackKey(enriched);
    const dedupeKey = enriched.sourceUrl || fallbackKey;

    if (!dedupeKey || localSeen.has(dedupeKey)) {
      continue;
    }
    localSeen.add(dedupeKey);

    let exists = false;
    if (enriched.sourceUrl) {
      exists = await docExistsByField(collectionRef, 'sourceUrl', enriched.sourceUrl);
    } else {
      exists = await docExistsByField(collectionRef, 'dedupeKey', fallbackKey);
    }
    if (exists) {
      continue;
    }

    toInsert.push({ ...enriched, dedupeKey });
  }

  let insertedCount = 0;
  const insertedItems = [];
  for (let i = 0; i < toInsert.length; i += 450) {
    const chunk = toInsert.slice(i, i + 450);
    const batch = db.batch();

    chunk.forEach((item) => {
      const docRef = collectionRef.doc();
      batch.set(docRef, item);
      insertedItems.push({ id: docRef.id, ...item });
    });

    await batch.commit();
    insertedCount += chunk.length;
  }

  if (collectionName === 'properties' && insertedItems.length > 0) {
    const onboardingModule = await import('@/lib/automation/onboarding-queue-adapter.cjs');
    const createQueueItem =
      onboardingModule.createOnboardingQueueItem ||
      onboardingModule.default?.createOnboardingQueueItem;

    if (createQueueItem) {
      await Promise.all(insertedItems.map((item) =>
        createQueueItem({
          db,
          collectionName,
          advertId: item.id,
          listing: item
        }).catch(() => null)
      ));
    }
  }

  return {
    insertedCount,
    skippedCount: scrapedItems.length - insertedCount
  };
}

export async function POST(request) {
  try {
    const adminResult = await isAdmin(request);
    if (!adminResult.success) {
      return authErrorResponse(adminResult.error);
    }

    let payload = {};
    try {
      payload = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 'INVALID_JSON_BODY', 400);
    }

    const source = normalizeText(payload.source).toLowerCase();
    const canonicalSource = getCanonicalSource ? getCanonicalSource(source) : source;
    const category = normalizeCategory(payload.category);
    const limit = parseLimit(payload.limit);

    if (!canonicalSource) {
      return errorResponse('source is required', 'SOURCE_REQUIRED', 400);
    }

    const supportedSources = getSupportedSources ? getSupportedSources() : [];
    if (!supportedSources.includes(canonicalSource)) {
      return errorResponse(`Unsupported source "${canonicalSource}"`, 'UNSUPPORTED_SOURCE', 400);
    }

    if (!category) {
      return errorResponse('category is required', 'CATEGORY_REQUIRED', 400);
    }

    const collectionName = resolveCollectionName(category);
    if (!collectionName) {
      return errorResponse(`Unsupported category "${category}"`, 'UNSUPPORTED_CATEGORY', 400);
    }

    if (limit === null) {
      return errorResponse('limit must be a positive integer', 'INVALID_LIMIT', 400);
    }
    const detail = payload.detail === true || payload.fetchDetails === true;
    const delayMs = Math.max(0, Number(payload.delayMs || 0));
    const maxAgeDays = Math.max(1, Number(payload.maxAgeDays || 60));

    let scrapedItems = [];
    try {
      scrapedItems = await runScraper({ source: canonicalSource, category, limit, detail, delayMs, maxAgeDays });
    } catch (error) {
      return errorResponse(`Scraper execution failed: ${error.message}`, 'SCRAPER_EXECUTION_FAILED', 500);
    }

    const db = getAdminFirestore();
    const persistResult = await scraperImportService.saveScrapedItems(
      db,
      collectionName,
      scrapedItems,
      category,
      canonicalSource
    );

    return NextResponse.json({
      success: true,
      source: canonicalSource,
      category,
      collection: collectionName,
      addedCount: persistResult.insertedCount,
      totalScraped: scrapedItems.length,
      skippedCount: persistResult.skippedCount
    });
  } catch (error) {
    console.error('POST /api/admin/scrapers/run failed:', error);
    return errorResponse('Unexpected server error while running scraper', 'SCRAPER_RUN_FAILED', 500);
  }
}

