export const dynamic = 'force-dynamic';
﻿import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import logger from '@/lib/logger';
import { getUserTrustFields } from '@/lib/kyc/kyc-service';
import listingRepository from '@/lib/db/listing-repository.cjs';

const { fetchUserListings, isAppDbEnabled, upsertPublicListings } = listingRepository;

const toDate = (value) => {
  if (!value) return null;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isPromotionActive = (ad, now = new Date()) => {
  if (!ad?.isPromoted) return false;
  const expiry = toDate(ad?.promotionExpiry);
  if (!expiry) return true;
  return expiry.getTime() > now.getTime();
};

const MAX_STRING_LENGTH_DEFAULT = 5000;
const FIELD_MAX_LENGTHS = {
  title: 160,
  name: 160,
  description: 5000,
  location: 180,
  interestedAreas: 300,
  houseRules: 2000,
  serviceType: 80,
  propertyType: 80,
  category: 80,
  subCategory: 80,
  condition: 80,
  noticeType: 60,
  jobType: 60,
  salary: 120,
  organizer: 120,
  company: 120,
  venue: 200,
  availability: 120,
  phoneNumber: 30,
  userPhoneNumber: 30,
  email: 254,
  userEmail: 254,
  website: 2048
};

function validateStringLengths(input, path = '') {
  if (typeof input === 'string') {
    const key = path.split('.').pop() || '';
    const maxLength = FIELD_MAX_LENGTHS[key] || MAX_STRING_LENGTH_DEFAULT;
    if (input.length > maxLength) {
      return {
        valid: false,
        field: path || key || 'value',
        maxLength,
        actualLength: input.length
      };
    }
    return { valid: true };
  }

  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i++) {
      const result = validateStringLengths(input[i], `${path}[${i}]`);
      if (!result.valid) return result;
    }
    return { valid: true };
  }

  if (input && typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      const nextPath = path ? `${path}.${key}` : key;
      const result = validateStringLengths(value, nextPath);
      if (!result.valid) return result;
    }
  }

  return { valid: true };
}

function normalizeImageUrls(data = {}) {
  const imageCandidates = [
    ...(Array.isArray(data.imageUrls) ? data.imageUrls : []),
    ...(Array.isArray(data.images) ? data.images : [])
  ];

  return [...new Set(
    imageCandidates
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  )];
}

// GET - Fetch user's ads across all collections
export async function GET(request) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Verify user can only fetch their own ads
    if (userId !== authResult.user.uid) {
      return NextResponse.json(
        { error: 'You can only view your own ads' },
        { status: 403 }
      );
    }

    // Define collections to fetch from
    const collections = ['properties', 'marketplace', 'services', 'noticeboard'];
    const requestedType = (searchParams.get('type') || 'all').trim().toLowerCase();
    const parsedLimit = Number(searchParams.get('limit') || 60);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.floor(parsedLimit), 1), 120)
      : 60;

    if (requestedType !== 'all' && !collections.includes(requestedType)) {
      return NextResponse.json(
        { error: 'Invalid ad type filter' },
        { status: 400 }
      );
    }

    const targetCollections = requestedType === 'all' ? collections : [requestedType];

    if (isAppDbEnabled()) {
      const ads = await fetchUserListings({ userId, collectionNames: targetCollections, limit });
      return NextResponse.json({
        success: true,
        ads,
        pagination: {
          limit,
          returned: ads.length,
          type: requestedType
        },
        source: 'postgres'
      });
    }

    // Emergency fallback only if PostgreSQL is disabled.
    const db = getAdminFirestore();
    const allAds = [];
    const perCollectionLimit = requestedType === 'all'
      ? Math.min(50, Math.max(10, Math.ceil(limit / targetCollections.length) + 5))
      : limit;

    // Fetch filtered collections concurrently and cap reads per collection.
    const snapshots = await Promise.all(
      targetCollections.map((collectionName) =>
        db
          .collection(collectionName)
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(perCollectionLimit)
          .get()
          .then((snapshot) => ({ collectionName, snapshot }))
      )
    );

    snapshots.forEach(({ collectionName, snapshot }) => {
      const collectionAds = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          collectionName,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || null
        };
      });

      allAds.push(...collectionAds);
    });

    // Prioritize active promoted listings, then fallback to newest first.
    const now = new Date();
    allAds.sort((a, b) => {
      const aPromoted = isPromotionActive(a, now);
      const bPromoted = isPromotionActive(b, now);
      if (aPromoted !== bPromoted) {
        return aPromoted ? -1 : 1;
      }

      const aTime = toDate(a.createdAt)?.getTime() || 0;
      const bTime = toDate(b.createdAt)?.getTime() || 0;
      return bTime - aTime;
    });

    const limitedAds = allAds.slice(0, limit);

    return NextResponse.json({
      success: true,
      ads: limitedAds,
      pagination: {
        limit,
        returned: limitedAds.length,
        type: requestedType
      }
    });

  } catch (error) {
    logger.error('Error fetching ads', error);
    return NextResponse.json(
      { error: 'Failed to fetch ads' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.user.uid;
    const data = await request.json();

    const lengthValidation = validateStringLengths(data);
    if (!lengthValidation.valid) {
      return NextResponse.json(
        {
          error: `Field '${lengthValidation.field}' exceeds max length of ${lengthValidation.maxLength} characters`,
          code: 'VALIDATION_LENGTH_EXCEEDED',
          field: lengthValidation.field,
          maxLength: lengthValidation.maxLength,
          actualLength: lengthValidation.actualLength
        },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!data.collectionName) {
      return NextResponse.json(
        { error: 'Collection name is required' },
        { status: 400 }
      );
    }

    // Validate collection name
    const validCollections = ['properties', 'marketplace', 'services', 'noticeboard', 'housemates'];
    if (!validCollections.includes(data.collectionName)) {
      return NextResponse.json(
        { error: 'Invalid collection name' },
        { status: 400 }
      );
    }

    if (data.collectionName === 'properties') {
      const normalizedImageUrls = normalizeImageUrls(data);
      if (normalizedImageUrls.length < 1) {
        return NextResponse.json(
          { error: 'At least one image is required to post an ad.' },
          { status: 400 }
        );
      }

      data.imageUrls = normalizedImageUrls;
      if (Object.prototype.hasOwnProperty.call(data, 'images')) {
        delete data.images;
      }
    }

    // Get Admin Firestore
    const db = getAdminFirestore();
    const userTrustFields = await getUserTrustFields(db, userId);

    // If a marketplace post is tied to a hub community, ensure user is an active member.
    const normalizedCommunityId =
      typeof data.communityId === 'string' ? data.communityId.trim() : '';
    if (data.collectionName === 'marketplace' && normalizedCommunityId) {
      const activeFlagSnapshot = await db.collection('hubMembers')
        .where('userId', '==', userId)
        .where('communityId', '==', normalizedCommunityId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      const isActiveMember = !activeFlagSnapshot.empty || !(await db.collection('hubMembers')
        .where('userId', '==', userId)
        .where('communityId', '==', normalizedCommunityId)
        .where('status', '==', 'active')
        .limit(1)
        .get()).empty;

      if (!isActiveMember) {
        return NextResponse.json(
          { error: 'You are not an active member of this community' },
          { status: 403 }
        );
      }
    }

    const collectionRef = db.collection(data.collectionName);
    const docRef = collectionRef.doc();

    // Generate slug for the document
    const { generateDocumentSlug } = await import('@/utils/slugify');
    const title = data.title || data.name || 'Untitled';
    const slug = generateDocumentSlug(title, docRef.id);

    // Remove collectionName from data before saving (it's metadata, not document data)
    const { collectionName, ...documentData } = data;

    // Prepare document data with proper timestamps and metadata
    const finalData = {
      ...documentData,
      ...userTrustFields,
      userId,
      slug,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      // Add search-friendly lowercase fields
      titleLower: title.toLowerCase(),
      locationLower: (data.location || '').toLowerCase(),
      // Parse numeric price for filtering
      priceNumeric: parseFloat(String(data.price || data.rentPerMonth || 0).replace(/[^0-9.]/g, '')) || 0
    };

    if (normalizedCommunityId) {
      finalData.communityId = normalizedCommunityId;
    }

    // For properties, infer listing type if not provided
    if (collectionName === 'properties' && !finalData.listingType) {
      finalData.listingType = data.rentPerMonth ? 'rent' : 'sale';
    }

    // Save to Firestore
    await docRef.set(finalData);

    if (isAppDbEnabled()) {
      try {
        await upsertPublicListings(collectionName, [{ id: docRef.id, ...finalData }]);
      } catch (postgresError) {
        logger.warn('Failed to sync created ad to PostgreSQL', {
          collectionName,
          docId: docRef.id,
          error: postgresError?.message
        });
      }
    }

    try {
      const onboardingModule = await import('@/lib/automation/onboarding-queue-adapter.cjs');
      const createQueueItem =
        onboardingModule.createOnboardingQueueItem ||
        onboardingModule.default?.createOnboardingQueueItem;

      if (createQueueItem) {
        await createQueueItem({
          db,
          collectionName,
          advertId: docRef.id,
          listing: { id: docRef.id, ...finalData }
        });
      }
    } catch (queueError) {
      logger.warn('Failed to enqueue onboarding outreach', {
        docId: docRef.id,
        error: queueError?.message
      });
    }

    logger.info(`Ad created successfully in ${collectionName}`, { docId: docRef.id, userId });

    return NextResponse.json({
      success: true,
      id: docRef.id,
      slug,
      collectionName
    });

  } catch (error) {
    logger.error('Error creating ad', error);
    return NextResponse.json(
      { error: 'Failed to create ad: ' + error.message },
      { status: 500 }
    );
  }
}

