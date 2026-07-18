import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeListingType(value) {
  const normalized = normalize(value).replace(/[_\s]+/g, '-');
  if (['sale', 'for-sale', 'forsale'].includes(normalized)) return 'sale';
  if (['rent', 'for-rent', 'forrent'].includes(normalized)) return 'rent';
  return '';
}

function parsePrice(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value || '').toLowerCase().replace(/,/g, '');
  if (!raw) return null;
  const shortMatch = raw.match(/(\d+(?:\.\d+)?)\s*(bn|billion|m|million|k|thousand)?/i);
  if (!shortMatch) return null;
  let amount = Number(shortMatch[1]);
  if (!Number.isFinite(amount)) return null;
  const suffix = shortMatch[2] || '';
  if (['bn', 'billion'].includes(suffix)) amount *= 1000000000;
  if (['m', 'million'].includes(suffix)) amount *= 1000000;
  if (['k', 'thousand'].includes(suffix)) amount *= 1000;
  return Math.round(amount);
}

function isActive(data = {}) {
  if (data.isDeleted || data.deletedAt || data.isActive === false) return false;
  const status = normalize(data.status);
  return !status || status === 'active';
}

function scoreListing(data, query) {
  let score = 0;
  const listingLocation = normalize(`${data.location || ''} ${data.address?.town || ''} ${data.address?.state || ''}`);
  const queryLocation = normalize(query.location);
  if (queryLocation && listingLocation.includes(queryLocation)) score += 5;
  if (queryLocation && queryLocation.split(/[,\s]+/).some((part) => part.length > 2 && listingLocation.includes(part))) score += 2;
  if (query.propertyType && normalize(data.propertyType || data.type) === query.propertyType) score += 3;
  if (query.listingType && normalizeListingType(data.listingType) === query.listingType) score += 3;
  if (query.bedrooms && Number(data.bedrooms) === Number(query.bedrooms)) score += 1;
  if (query.bathrooms && Number(data.bathrooms) === Number(query.bathrooms)) score += 1;
  return score;
}

function percentile(sorted, ratio) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)));
  return sorted[index];
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = {
      location: searchParams.get('location') || '',
      propertyType: normalize(searchParams.get('propertyType')),
      bedrooms: searchParams.get('bedrooms') || '',
      bathrooms: searchParams.get('bathrooms') || '',
      listingType: normalizeListingType(searchParams.get('listingType'))
    };

    if (!query.location || !query.propertyType || !query.listingType) {
      return NextResponse.json({
        success: true,
        suggestion: null,
        reason: 'location_propertyType_listingType_required'
      });
    }

    const snapshot = await getAdminFirestore()
      .collection('properties')
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();

    const candidates = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(isActive)
      .map((item) => ({
        ...item,
        amount: parsePrice(item.priceNumeric ?? item.price ?? item.salePrice ?? item.rentAmount?.monthly ?? item.rentAmount?.annual),
        score: scoreListing(item, query)
      }))
      .filter((item) => item.amount && item.amount > 0 && item.score >= 5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 80);

    if (candidates.length < 3) {
      return NextResponse.json({
        success: true,
        suggestion: null,
        reason: 'not_enough_similar_listings',
        sampleSize: candidates.length
      });
    }

    const prices = candidates.map((item) => item.amount).sort((a, b) => a - b);
    const sampleSize = prices.length;
    const suggestion = {
      min: percentile(prices, 0.2),
      median: percentile(prices, 0.5),
      max: percentile(prices, 0.8),
      sampleSize,
      confidence: sampleSize >= 15 ? 'high' : sampleSize >= 8 ? 'medium' : 'low'
    };

    return NextResponse.json({ success: true, suggestion });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate price suggestion' },
      { status: 500 }
    );
  }
}
