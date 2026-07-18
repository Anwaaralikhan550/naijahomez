function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function titleCase(value) {
  return normalizeText(value)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function sanitizeMarketingText(value) {
  return normalizeText(value)
    .replace(/\b(?:premium|upscale|luxury|luxurious|excellent|prime|perfect|exclusive|stunning|amazing|desirable|sought-after|serene|secure|quality|spacious|well-built|well built|beautiful|tastefully|executive)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveListingType(item = {}) {
  const explicit = normalizeText(item.listingType).toLowerCase();
  if (explicit === 'rent' || explicit === 'for-rent') return 'rent';
  if (explicit === 'sale' || explicit === 'for-sale') return 'sale';

  const haystack = [item.title, item.price, item.sourceUrl, item.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/rent|to let|lease|per annum|per month|yearly|monthly|for-rent/.test(haystack)) return 'rent';
  if (/sale|buy|purchase|selling|for-sale/.test(haystack)) return 'sale';
  return 'available';
}

function resolvePropertyType(item = {}) {
  return normalizeText(item.propertyType || item.type || item.category || 'property').toLowerCase();
}

function formatPropertyType(item = {}) {
  const rawType = resolvePropertyType(item);
  if (!rawType || rawType === 'property') return 'property';
  return rawType.replace(/[_-]+/g, ' ');
}

function getBedroomPhrase(item = {}) {
  const bedrooms = asNumber(item.bedrooms);
  if (!bedrooms) return '';
  return `${bedrooms}-bedroom`;
}

function resolvePrimaryLocation(item = {}) {
  if (item.location) return normalizeText(item.location);
  if (item.address && typeof item.address === 'object') {
    return [item.address.street, item.address.town, item.address.state]
      .map(normalizeText)
      .filter(Boolean)
      .join(', ');
  }
  return 'Nigeria';
}

function buildListingFacts(item = {}) {
  const listingType = resolveListingType(item);
  const propertyType = formatPropertyType(item);
  const bedroomPhrase = getBedroomPhrase(item);
  const title = sanitizeMarketingText(item.title);

  return {
    title,
    location: resolvePrimaryLocation(item),
    price: normalizeText(item.price || item.rate || (item.priceNumeric ? `NGN ${item.priceNumeric}` : '')),
    bedrooms: asNumber(item.bedrooms),
    bathrooms: asNumber(item.bathrooms),
    toilets: asNumber(item.toilets),
    squareMeters: asNumber(item.squareMeters || item.size),
    parkingSpaces: asNumber(item.parkingSpaces),
    listingType,
    propertyType,
    summaryType: normalizeText([bedroomPhrase, propertyType].filter(Boolean).join(' ')) || title || 'property'
  };
}

function buildFallbackListingDescription(item = {}) {
  const facts = buildListingFacts(item);
  const action = facts.listingType === 'sale'
    ? 'listed for sale'
    : facts.listingType === 'rent'
      ? 'available for rent'
      : 'available';
  const priceSentence = facts.price
    ? `The advertised price is ${facts.price}.`
    : 'The price should be confirmed directly with the agent.';
  const roomSentence = [
    facts.bedrooms ? `${facts.bedrooms} bedroom${facts.bedrooms === 1 ? '' : 's'}` : '',
    facts.bathrooms ? `${facts.bathrooms} bathroom${facts.bathrooms === 1 ? '' : 's'}` : ''
  ].filter(Boolean).join(' and ');
  const sizeSentence = facts.squareMeters
    ? `The listed area is ${facts.squareMeters.toLocaleString()} sqm.`
    : '';

  return normalizeText([
    `This ${facts.summaryType} is ${action} in ${facts.location}.`,
    roomSentence ? `It includes ${roomSentence}, based on the available listing details.` : '',
    sizeSentence,
    priceSentence,
    'Please contact the agent to confirm current availability, viewing arrangements, full fees, and any updates before making a decision.'
  ].filter(Boolean).join(' '));
}

function cleanGeneratedDescription(value) {
  return normalizeText(value)
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\*\*/g, '')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, '')
    .replace(/\+?\d[\d\s().-]{8,}\d/g, '')
    .replace(/\b(as an ai|i cannot|i can't|source website|nigeria property centre)\b/gi, '')
    .trim();
}

function shouldUsePublicGeneratedDescription(item = {}) {
  if (!(item.isScraped === true || item.isScrapedData === true || item.dataSource === 'scraped' || item.sourceUrl)) {
    return false;
  }
  return item.descriptionGenerationMode !== 'facts_only';
}

function withPublicSafeDescription(item = {}) {
  if (!shouldUsePublicGeneratedDescription(item)) return item;
  return {
    ...item,
    description: item.generatedDescription || buildFallbackListingDescription(item),
    descriptionGenerationMode: item.descriptionGenerationMode || 'facts_only_public_fallback',
    descriptionGeneratedBy: item.descriptionGeneratedBy || 'template'
  };
}

async function callGeminiForDescription(item = {}, options = {}) {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing.');

  const model = options.model || process.env.SCRAPER_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const facts = buildListingFacts(item);

  const prompt = [
    'You write original property listing descriptions for Nijahomzs, a Nigerian property marketplace.',
    'Use only the factual fields provided below. Do not copy, paraphrase, or imitate any source advert wording.',
    'Do not invent amenities, exact condition, estate benefits, security, roads, neighbourhood prestige, size claims, or market statistics.',
    'Avoid unsupported adjectives such as premium, spacious, luxury, sought-after, desirable, serene, secure, or quality unless the facts explicitly say so.',
    'Do not make suitability claims such as suitable for families, professionals, or business operations unless the facts explicitly say so.',
    'Use professional Nigerian English, natural SEO-friendly language, and a helpful buyer/renter tone.',
    'Write neutral factual listing copy, not advertising copy. Prefer wording like "This listing is for..." or "The available details describe...".',
    'Avoid hype words such as discover, excellent, prime, perfect, exclusive, best, stunning, or amazing.',
    'Keep it 70 to 115 words. No emojis. No markdown. No bullet points. No phone numbers. No URLs.',
    'End by reminding readers to confirm availability, fees, and viewing details with the agent.',
    '',
    `Title/factual label: ${facts.title || 'Property listing'}`,
    `Location: ${facts.location}`,
    `Price: ${facts.price || 'Not provided'}`,
    `Listing type: ${facts.listingType}`,
    `Property type: ${facts.propertyType}`,
    `Bedrooms: ${facts.bedrooms || 'Not provided'}`,
    `Bathrooms: ${facts.bathrooms || 'Not provided'}`,
    `Toilets: ${facts.toilets || 'Not provided'}`,
    `Area: ${facts.squareMeters ? `${facts.squareMeters} sqm` : 'Not provided'}`,
    `Parking spaces: ${facts.parkingSpaces || 'Not provided'}`
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(options.timeoutMs || 18000));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.45,
          topP: 0.85,
          maxOutputTokens: 900,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Gemini listing description failed (${response.status}): ${detail.slice(0, 220)}`);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
    const description = cleanGeneratedDescription(text);

    if (description.length < 80 || description.length > 900) {
      throw new Error('Generated description length was outside the safe range.');
    }

    return description;
  } finally {
    clearTimeout(timer);
  }
}

async function generateOriginalListingDescription(item = {}, options = {}) {
  const allowGemini = options.allowGemini !== false && process.env.SCRAPER_GENERATE_DESCRIPTIONS !== 'false';

  if (allowGemini) {
    try {
      const description = await callGeminiForDescription(item, options);
      return {
        description,
        generatedBy: 'gemini',
        generationMode: 'facts_only',
        error: null
      };
    } catch (error) {
      if (options.throwOnError) throw error;
      return {
        description: buildFallbackListingDescription(item),
        generatedBy: 'template',
        generationMode: 'facts_only',
        error: error.message
      };
    }
  }

  return {
    description: buildFallbackListingDescription(item),
    generatedBy: 'template',
    generationMode: 'facts_only',
    error: null
  };
}

async function applyGeneratedDescription(item = {}, options = {}) {
  const generated = await generateOriginalListingDescription(item, options);
  const nowIso = new Date().toISOString();

  return {
    ...item,
    description: generated.description,
    generatedDescription: generated.description,
    descriptionGeneratedBy: generated.generatedBy,
    descriptionGenerationMode: generated.generationMode,
    descriptionGeneratedAt: nowIso,
    descriptionGenerationError: generated.error || null,
    sourceMetadata: {
      ...(item.sourceMetadata || {}),
      originalDescriptionPubliclyHidden: true,
      descriptionPolicy: 'facts_only_original_summary'
    }
  };
}

module.exports = {
  applyGeneratedDescription,
  buildFallbackListingDescription,
  buildListingFacts,
  cleanGeneratedDescription,
  generateOriginalListingDescription,
  sanitizeMarketingText,
  shouldUsePublicGeneratedDescription,
  titleCase,
  withPublicSafeDescription
};
