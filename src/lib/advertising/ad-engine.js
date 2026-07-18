const axios = require('axios');
const { FieldValue } = require('firebase-admin/firestore');
const { getAutomationFirestore } = require('../automation/admin-firestore');
const analyticsRepository = require('../db/analytics-repository.cjs');

const AD_SLOTS = {
  home_between_listings: { label: 'Home sponsored listing', minBudget: 5000 },
  search_sponsored_card: { label: 'Search sponsored card', minBudget: 7500 },
  property_detail_sidebar: { label: 'Property detail sidebar', minBudget: 10000 },
  market_insights_banner: { label: 'Market insights banner', minBudget: 5000 }
};

const ALLOWED_STATUS = ['draft', 'payment_pending', 'paid_pending_review', 'active', 'paused', 'rejected', 'expired'];
const DEFAULT_CURRENCY = 'NGN';
const SHARD_COUNT = 10;
const LISTING_REPORT_COLLECTIONS = ['properties', 'marketplace', 'housemates', 'noticeboard', 'services', 'tradespeople'];

function db() {
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

function normalize(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'all';
}

function normalizePage(value) {
  const page = normalize(value || '/').replace(/^https?:\/\/[^/]+/i, '');
  return page.startsWith('/') ? page.slice(0, 120) : `/${page}`.slice(0, 120);
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function canonicalCategoryKey(value) {
  const key = normalizeKey(value);
  const aliases = {
    property: 'properties',
    properties: 'properties',
    real_estate: 'properties',
    home: 'properties',
    homes: 'properties',
    marketplace: 'marketplace',
    market: 'marketplace',
    item: 'marketplace',
    items: 'marketplace',
    housemate: 'housemates',
    housemates: 'housemates',
    roommate: 'housemates',
    roommates: 'housemates',
    service: 'services',
    services: 'services',
    tradesperson: 'tradespeople',
    tradespeople: 'tradespeople',
    trade: 'tradespeople',
    trades: 'tradespeople',
    notice: 'noticeboard',
    notices: 'noticeboard',
    noticeboard: 'noticeboard'
  };
  return aliases[key] || key;
}

function dayKey(date = nowDate()) {
  return date.toISOString().slice(0, 10);
}

function metricRowToLegacyShape(row) {
  return {
    id: `${row.day}__${row.dimensionKey}`,
    dateKey: row.day,
    ...row.data,
    count: row.count,
    updatedAt: row.updatedAt
  };
}

function serializeDoc(doc) {
  if (!doc?.exists) return null;
  const data = doc.data() || {};
  return {
    id: doc.id,
    ...data,
    startAt: toIso(data.startAt),
    endAt: toIso(data.endAt),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    approvedAt: toIso(data.approvedAt),
    rejectedAt: toIso(data.rejectedAt),
    paidAt: toIso(data.paidAt),
    generatedAt: toIso(data.generatedAt)
  };
}

function cleanArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalize(item)).filter(Boolean).slice(0, 20);
}

function campaignPublicShape(campaign) {
  if (!campaign) return null;
  return {
    id: campaign.id,
    title: campaign.title,
    description: campaign.description || '',
    creativeUrl: campaign.creativeUrl,
    destinationUrl: campaign.destinationUrl,
    slot: campaign.slot,
    advertiserName: campaign.advertiserName || 'Sponsored',
    ctaLabel: campaign.ctaLabel || 'Learn more'
  };
}

function matchesTarget(campaign, { location, propertyCategory }) {
  const target = campaign.targeting || {};
  const locations = cleanArray(target.locations).map(normalizeKey);
  const categories = cleanArray(target.propertyCategories).map(canonicalCategoryKey);
  const locationKey = normalizeKey(location);
  const categoryKey = canonicalCategoryKey(propertyCategory);

  const locationMatch = locations.length === 0 || locations.includes('all') || locations.some((item) => locationKey.includes(item) || item.includes(locationKey));
  const categoryMatch = categories.length === 0 || categories.includes('all') || categories.includes(categoryKey);
  return locationMatch && categoryMatch;
}

function isCampaignLive(campaign, now = nowDate()) {
  if (campaign.status !== 'active') return false;
  if (campaign.paymentStatus !== 'paid') return false;
  const startAt = toDate(campaign.startAt);
  const endAt = toDate(campaign.endAt);
  if (startAt && startAt > now) return false;
  if (endAt && endAt < now) return false;
  if (Number(campaign.budget || 0) > 0 && Number(campaign.spendUsed || 0) >= Number(campaign.budget || 0)) return false;
  return true;
}

async function selectAd({ slot, location = '', propertyCategory = '', limit = 1 }) {
  if (!AD_SLOTS[slot]) {
    const error = new Error('Unsupported ad slot.');
    error.status = 400;
    throw error;
  }

  const snap = await db().collection('adCampaigns')
    .where('status', '==', 'active')
    .limit(100)
    .get();

  const now = nowDate();
  const campaigns = snap.docs
    .map(serializeDoc)
    .filter((campaign) => campaign.slot === slot)
    .filter((campaign) => isCampaignLive(campaign, now))
    .filter((campaign) => matchesTarget(campaign, { location, propertyCategory }))
    .sort((a, b) => {
      const scoreA = Number(a.metrics?.clicks || 0) + Number(a.metrics?.impressions || 0) / 1000;
      const scoreB = Number(b.metrics?.clicks || 0) + Number(b.metrics?.impressions || 0) / 1000;
      return scoreA - scoreB;
    })
    .slice(0, Math.max(1, Math.min(Number(limit) || 1, 4)));

  return campaigns.map(campaignPublicShape);
}

async function createCampaign({ userId, userEmail, data }) {
  const slot = normalize(data.slot);
  if (!AD_SLOTS[slot]) {
    const error = new Error('Select a valid ad slot.');
    error.status = 400;
    throw error;
  }

  const title = normalize(data.title).slice(0, 100);
  const creativeUrl = normalize(data.creativeUrl);
  const destinationUrl = normalize(data.destinationUrl);
  const budget = Math.max(Number(data.budget || 0), AD_SLOTS[slot].minBudget);
  const durationDays = Math.max(1, Math.min(Number(data.durationDays || 7), 90));

  if (!title || !creativeUrl || !destinationUrl) {
    const error = new Error('Title, creative image, and destination URL are required.');
    error.status = 400;
    throw error;
  }

  const now = nowDate();
  const ref = db().collection('adCampaigns').doc();
  const campaign = {
    userId,
    userEmail: userEmail || null,
    advertiserName: normalize(data.advertiserName || userEmail || 'Advertiser'),
    title,
    description: normalize(data.description).slice(0, 220),
    creativeUrl,
    destinationUrl,
    ctaLabel: normalize(data.ctaLabel || 'Learn more').slice(0, 32),
    slot,
    targeting: {
      locations: cleanArray(data.targeting?.locations || data.locations),
      propertyCategories: cleanArray(data.targeting?.propertyCategories || data.propertyCategories)
    },
    budget,
    currency: DEFAULT_CURRENCY,
    durationDays,
    startAt: null,
    endAt: null,
    status: 'payment_pending',
    paymentStatus: 'unpaid',
    metrics: { impressions: 0, clicks: 0 },
    createdAt: now,
    updatedAt: now
  };

  await ref.set(campaign);
  return serializeDoc(await ref.get());
}

function metricDocId({ campaignId, slot, location, propertyCategory, date = nowDate() }) {
  return [
    dayKey(date),
    campaignId,
    normalizeKey(slot),
    normalizeKey(location),
    normalizeKey(propertyCategory)
  ].join('__');
}

async function recordAdImpressions({ impressions = [] }) {
  const database = db();
  const batch = database.batch();
  const date = nowDate();
  const grouped = new Map();
  const campaignTotals = new Map();

  impressions.forEach((item) => {
    const campaignId = normalize(item.campaignId);
    const slot = normalize(item.slot);
    if (!campaignId || !AD_SLOTS[slot]) return;
    const key = metricDocId({
      campaignId,
      slot,
      location: item.location || '',
      propertyCategory: item.propertyCategory || '',
      date
    });
    grouped.set(key, {
      campaignId,
      slot,
      location: normalize(item.location || 'all'),
      propertyCategory: normalize(item.propertyCategory || 'all'),
      count: (grouped.get(key)?.count || 0) + Math.max(1, Number(item.count || 1))
    });
  });

  grouped.forEach((item, id) => {
    campaignTotals.set(item.campaignId, (campaignTotals.get(item.campaignId) || 0) + item.count);
    const metricRef = database.collection('adMetricDaily').doc(id);
    batch.set(metricRef, {
      dateKey: dayKey(date),
      campaignId: item.campaignId,
      slot: item.slot,
      location: item.location,
      propertyCategory: item.propertyCategory,
      impressions: FieldValue.increment(item.count),
      updatedAt: date
    }, { merge: true });

    const shardId = `${id}__shard_${Math.floor(Math.random() * SHARD_COUNT)}`;
    batch.set(database.collection('adMetricShards').doc(shardId), {
      parentMetricId: id,
      impressions: FieldValue.increment(item.count),
      updatedAt: date
    }, { merge: true });
  });

  campaignTotals.forEach((count, campaignId) => {
    batch.update(database.collection('adCampaigns').doc(campaignId), {
      'metrics.impressions': FieldValue.increment(count),
      updatedAt: date
    });
  });

  if (grouped.size > 0) await batch.commit();
  return { accepted: grouped.size, impressions: Array.from(grouped.values()).reduce((sum, item) => sum + item.count, 0) };
}

async function recordAdClick({ campaignId, slot, location = '', propertyCategory = '' }) {
  const database = db();
  const date = nowDate();
  const campaignRef = database.collection('adCampaigns').doc(campaignId);
  const campaignDoc = await campaignRef.get();
  if (!campaignDoc.exists) {
    const error = new Error('Campaign not found.');
    error.status = 404;
    throw error;
  }

  const metricId = metricDocId({ campaignId, slot, location, propertyCategory, date });
  const batch = database.batch();
  batch.set(database.collection('adMetricDaily').doc(metricId), {
    dateKey: dayKey(date),
    campaignId,
    slot,
    location: normalize(location || 'all'),
    propertyCategory: normalize(propertyCategory || 'all'),
    clicks: FieldValue.increment(1),
    updatedAt: date
  }, { merge: true });
  batch.update(campaignRef, {
    'metrics.clicks': FieldValue.increment(1),
    lastClickedAt: date,
    updatedAt: date
  });
  batch.set(database.collection('adClickEvents').doc(), {
    campaignId,
    slot,
    location: normalize(location),
    propertyCategory: normalize(propertyCategory),
    createdAt: date
  });
  await batch.commit();

  return serializeDoc(await campaignRef.get());
}

async function recordJourneyEvent({ step, source = '', location = '', listingType = '', page = '', device = '', element = '', userId = null }) {
  const allowed = ['landing', 'search', 'listing_view', 'whatsapp_click', 'call_click', 'campaign_click', 'lead_submit', 'signup_start', 'signup_complete'];
  if (!allowed.includes(step)) return { accepted: false };
  const date = nowDate();
  const dimensionKey = [
    normalizeKey(step),
    normalizeKey(source),
    normalizeKey(location),
    canonicalCategoryKey(listingType),
    normalizeKey(device),
    normalizeKey(normalizePage(page))
  ].join('__');
  await analyticsRepository.upsertDailyMetric({
    day: date,
    metricName: 'journey_step',
    dimensionKey,
    incrementBy: 1,
    data: {
      step,
      source: normalize(source || 'direct'),
      location: normalize(location || 'all'),
      listingType: normalize(listingType || 'all'),
      page: normalizePage(page || '/'),
      device: normalize(device || 'unknown'),
      element: normalize(element || '').slice(0, 100)
    }
  });
  return { accepted: true };
}

async function recordHeatmapEvent({ page = '', element = '', xPercent = 0, yPercent = 0, viewport = '', device = '' }) {
  const date = nowDate();
  const x = clampPercent(xPercent);
  const y = clampPercent(yPercent);
  const xBucket = Math.floor(x / 10) * 10;
  const yBucket = Math.floor(y / 10) * 10;
  const cleanPage = normalizePage(page || '/');
  const cleanElement = normalize(element || 'page').slice(0, 80) || 'page';
  const cleanDevice = normalize(device || 'unknown').slice(0, 32);
  const dimensionKey = [normalizeKey(cleanPage), normalizeKey(cleanDevice), normalizeKey(cleanElement), `x${xBucket}`, `y${yBucket}`].join('__');

  await analyticsRepository.upsertDailyMetric({
    day: date,
    metricName: 'heatmap_click',
    dimensionKey,
    incrementBy: 1,
    data: {
      page: cleanPage,
      element: cleanElement,
      device: cleanDevice,
      viewport: normalize(viewport).slice(0, 32),
      xBucket,
      yBucket
    }
  });

  return { accepted: true };
}

async function listUserCampaigns(userId) {
  const snap = await db().collection('adCampaigns').where('userId', '==', userId).limit(80).get();
  return snap.docs.map(serializeDoc).sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0));
}

async function listAdminAdvertising() {
  const database = db();
  const [campaignsSnap, metricsSnap, journeyRows, heatmapRows, marketSnap, agentSnap] = await Promise.all([
    database.collection('adCampaigns').limit(100).get(),
    database.collection('adMetricDaily').limit(200).get(),
    analyticsRepository.listDailyMetrics({ metricName: 'journey_step', limit: 300 }),
    analyticsRepository.listDailyMetrics({ metricName: 'heatmap_click', limit: 300 }),
    database.collection('marketEngagementReports').orderBy('generatedAt', 'desc').limit(5).get().catch(() => ({ docs: [] })),
    database.collection('agentActivityReports').orderBy('generatedAt', 'desc').limit(5).get().catch(() => ({ docs: [] }))
  ]);
  return {
    campaigns: campaignsSnap.docs.map(serializeDoc).sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)),
    metrics: metricsSnap.docs.map(serializeDoc),
    journeyMetrics: journeyRows.map(metricRowToLegacyShape),
    heatmapMetrics: heatmapRows.map(metricRowToLegacyShape),
    marketReports: marketSnap.docs.map(serializeDoc),
    agentReports: agentSnap.docs.map(serializeDoc)
  };
}

async function updateCampaignStatus({ campaignId, action, adminId }) {
  const next = action === 'approve' ? 'active' : action === 'reject' ? 'rejected' : action === 'pause' ? 'paused' : null;
  if (!next) {
    const error = new Error('Unsupported campaign action.');
    error.status = 400;
    throw error;
  }
  const ref = db().collection('adCampaigns').doc(campaignId);
  const doc = await ref.get();
  if (!doc.exists) {
    const error = new Error('Campaign not found.');
    error.status = 404;
    throw error;
  }
  const data = doc.data() || {};
  const now = nowDate();
  const durationDays = Math.max(1, Number(data.durationDays || 7));
  const patch = {
    status: next,
    reviewedBy: adminId,
    updatedAt: now
  };
  if (next === 'active') {
    if (data.paymentStatus !== 'paid') {
      const error = new Error('Campaign must be paid before approval.');
      error.status = 400;
      throw error;
    }
    patch.approvedAt = now;
    patch.startAt = data.startAt || now;
    patch.endAt = data.endAt || new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }
  if (next === 'rejected') patch.rejectedAt = now;
  await ref.set(patch, { merge: true });
  return serializeDoc(await ref.get());
}

function buildFlutterwaveTxRef(campaignId) {
  return `ad_${campaignId}_${Date.now()}`;
}

async function initializeCampaignPayment({ campaignId, userId, userEmail, origin }) {
  const database = db();
  const ref = database.collection('adCampaigns').doc(campaignId);
  const doc = await ref.get();
  if (!doc.exists) {
    const error = new Error('Campaign not found.');
    error.status = 404;
    throw error;
  }
  const campaign = doc.data() || {};
  if (campaign.userId !== userId) {
    const error = new Error('You can only pay for your own campaign.');
    error.status = 403;
    throw error;
  }

  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) {
    const error = new Error('Flutterwave secret key is not configured.');
    error.status = 503;
    throw error;
  }

  const txRef = buildFlutterwaveTxRef(campaignId);
  const redirectUrl = `${origin}/dashboard?tab=advertising&campaignId=${encodeURIComponent(campaignId)}&payment=flutterwave`;
  const payload = {
    tx_ref: txRef,
    amount: Number(campaign.budget || 0),
    currency: campaign.currency || DEFAULT_CURRENCY,
    redirect_url: redirectUrl,
    customer: { email: userEmail || campaign.userEmail || 'advertiser@nijahomzs.com', name: campaign.advertiserName || 'Advertiser' },
    customizations: { title: 'Nijahomzs Advertising Campaign', description: campaign.title },
    meta: { paymentType: 'ad_campaign', campaignId, userId }
  };

  const response = await axios.post(`${process.env.FLUTTERWAVE_BASE_URL || 'https://api.flutterwave.com/v3'}/payments`, payload, {
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' }
  });
  const link = response?.data?.data?.link;
  if (!link) throw new Error('Flutterwave did not return a payment link.');

  await database.collection('adCampaignPayments').doc(txRef).set({
    campaignId,
    userId,
    txRef,
    amount: campaign.budget,
    currency: campaign.currency || DEFAULT_CURRENCY,
    provider: 'flutterwave',
    status: 'pending',
    createdAt: nowDate(),
    updatedAt: nowDate()
  });
  await ref.set({ paymentStatus: 'pending', paymentTxRef: txRef, updatedAt: nowDate() }, { merge: true });
  return { link, txRef };
}

async function verifyCampaignPayment({ txRef, transactionId }) {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) {
    const error = new Error('Flutterwave secret key is not configured.');
    error.status = 503;
    throw error;
  }
  const endpoint = transactionId
    ? `${process.env.FLUTTERWAVE_BASE_URL || 'https://api.flutterwave.com/v3'}/transactions/${transactionId}/verify`
    : `${process.env.FLUTTERWAVE_BASE_URL || 'https://api.flutterwave.com/v3'}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`;
  const response = await axios.get(endpoint, { headers: { Authorization: `Bearer ${secretKey}` } });
  const data = response?.data?.data;
  const providerTxRef = data?.tx_ref || txRef;
  const paymentDoc = await db().collection('adCampaignPayments').doc(providerTxRef).get();
  if (!paymentDoc.exists) {
    const error = new Error('Campaign payment not found.');
    error.status = 404;
    throw error;
  }
  const payment = paymentDoc.data() || {};
  if (String(data?.status || '').toLowerCase() !== 'successful') {
    const error = new Error('Payment is not successful.');
    error.status = 400;
    throw error;
  }
  const now = nowDate();
  await db().runTransaction(async (transaction) => {
    transaction.set(paymentDoc.ref, {
      status: 'successful',
      providerTransactionId: String(data?.id || transactionId || ''),
      providerResponse: data,
      updatedAt: now
    }, { merge: true });
    transaction.set(db().collection('adCampaigns').doc(payment.campaignId), {
      paymentStatus: 'paid',
      status: 'paid_pending_review',
      paidAt: now,
      updatedAt: now
    }, { merge: true });
    transaction.set(db().collection('transactionLogs').doc(`ad_${providerTxRef}`), {
      provider: 'flutterwave',
      purpose: 'ad_campaign',
      campaignId: payment.campaignId,
      txRef: providerTxRef,
      amount: payment.amount,
      currency: payment.currency,
      status: 'successful',
      createdAt: now,
      updatedAt: now
    }, { merge: true });
  });
  return { success: true, campaignId: payment.campaignId, txRef: providerTxRef };
}

async function generateWeeklyReports() {
  const database = db();
  const [journeyRows, heatmapRows, adSnap, campaignsSnap, ...listingSnaps] = await Promise.all([
    analyticsRepository.listDailyMetrics({ metricName: 'journey_step', limit: 500 }),
    analyticsRepository.listDailyMetrics({ metricName: 'heatmap_click', limit: 500 }),
    database.collection('adMetricDaily').limit(500).get(),
    database.collection('adCampaigns').limit(500).get(),
    ...LISTING_REPORT_COLLECTIONS.map((collection) => database.collection(collection).limit(500).get().catch(() => ({ docs: [] })))
  ]);
  const now = nowDate();
  const campaignByAgent = new Map();
  campaignsSnap.docs.map(serializeDoc).forEach((campaign) => {
    const key = campaign.userId || 'unknown';
    const prev = campaignByAgent.get(key) || { userId: key, email: campaign.userEmail || null, campaigns: 0, clicks: 0, impressions: 0 };
    prev.campaigns += 1;
    prev.clicks += Number(campaign.metrics?.clicks || 0);
    prev.impressions += Number(campaign.metrics?.impressions || 0);
    campaignByAgent.set(key, prev);
  });

  const journey = journeyRows.map(metricRowToLegacyShape);
  const heatmap = heatmapRows.map(metricRowToLegacyShape);
  const hotLocations = {};
  const funnelTotals = {};
  const listingTypeTotals = {};
  const deviceTotals = {};
  journey.forEach((item) => {
    const key = item.location || 'all';
    hotLocations[key] = (hotLocations[key] || 0) + Number(item.count || 0);
    funnelTotals[item.step || 'unknown'] = (funnelTotals[item.step || 'unknown'] || 0) + Number(item.count || 0);
    listingTypeTotals[item.listingType || 'all'] = (listingTypeTotals[item.listingType || 'all'] || 0) + Number(item.count || 0);
    deviceTotals[item.device || 'unknown'] = (deviceTotals[item.device || 'unknown'] || 0) + Number(item.count || 0);
  });

  const listingAgents = new Map();
  listingSnaps.forEach((snap, index) => {
    const collectionName = LISTING_REPORT_COLLECTIONS[index];
    snap.docs.forEach((doc) => {
      const data = doc.data() || {};
      const userId = data.userId || data.ownerId || data.agentId;
      if (!userId) return;
      const prev = listingAgents.get(userId) || {
        userId,
        email: data.userEmail || data.email || data.agent?.email || null,
        name: data.agentName || data.agent?.name || data.name || null,
        listings: 0,
        views: 0,
        clicks: 0,
        campaigns: 0,
        impressions: 0,
        score: 0,
        collections: {}
      };
      prev.listings += 1;
      prev.views += Number(data.viewCount || 0);
      prev.clicks += Number(data.clickCount || 0);
      prev.collections[collectionName] = (prev.collections[collectionName] || 0) + 1;
      listingAgents.set(userId, prev);
    });
  });

  campaignByAgent.forEach((campaignAgent, userId) => {
    const prev = listingAgents.get(userId) || {
      userId,
      email: campaignAgent.email || null,
      name: null,
      listings: 0,
      views: 0,
      clicks: 0,
      campaigns: 0,
      impressions: 0,
      score: 0,
      collections: {}
    };
    prev.campaigns += campaignAgent.campaigns;
    prev.clicks += campaignAgent.clicks;
    prev.impressions += campaignAgent.impressions;
    listingAgents.set(userId, prev);
  });

  const agents = Array.from(listingAgents.values()).map((agent) => {
    const score = agent.clicks * 5 + agent.views + agent.impressions / 25 + agent.campaigns * 10 + agent.listings * 2;
    return { ...agent, score: Math.round(score) };
  });

  await Promise.all([
    database.collection('marketEngagementReports').doc(dayKey(now)).set({
      generatedAt: now,
      hotLocations: Object.entries(hotLocations).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([location, count]) => ({ location, count })),
      funnelTotals,
      listingTypeTotals: Object.entries(listingTypeTotals).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([listingType, count]) => ({ listingType, count })),
      deviceTotals,
      heatmapHotspots: heatmap
        .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
        .slice(0, 20)
        .map((item) => ({
          page: item.page,
          element: item.element,
          device: item.device,
          xBucket: item.xBucket,
          yBucket: item.yBucket,
          count: Number(item.count || 0)
        })),
      adMetricDocs: adSnap.size,
      journeyMetricDocs: journeySnap.size,
      heatmapMetricDocs: heatmapSnap.size
    }, { merge: true }),
    database.collection('agentActivityReports').doc(dayKey(now)).set({
      generatedAt: now,
      agents: agents.sort((a, b) => b.score - a.score).slice(0, 30)
    }, { merge: true })
  ]);

  return { generatedAt: now.toISOString(), journeyMetricDocs: journeySnap.size, heatmapMetricDocs: heatmapSnap.size, adMetricDocs: adSnap.size, agentCount: agents.length };
}

module.exports = {
  AD_SLOTS,
  ALLOWED_STATUS,
  selectAd,
  createCampaign,
  listUserCampaigns,
  listAdminAdvertising,
  updateCampaignStatus,
  recordAdImpressions,
  recordAdClick,
  recordJourneyEvent,
  recordHeatmapEvent,
  initializeCampaignPayment,
  verifyCampaignPayment,
  generateWeeklyReports
};
