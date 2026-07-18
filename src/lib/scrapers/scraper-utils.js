const axios = require('axios');
const { spawn } = require('child_process');

const DEFAULT_TIMEOUT_MS = 25000;
const DEFAULT_RETRIES = 2;
const DEFAULT_MAX_AGE_DAYS = 60;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36'
];

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return normalizeText(String(value || '').replace(/<[^>]*>/g, ' '));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function pickUserAgent() {
  return USER_AGENTS[randomInt(0, USER_AGENTS.length - 1)];
}

function toAbsoluteUrl(input, baseUrl) {
  const value = normalizeText(input);
  if (!value || value.startsWith('data:')) return '';
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return '';
  }
}

function normalizeImageUrls(value, baseUrl) {
  const values = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      values
        .map((item) => normalizeText(item))
        .map((item) => toAbsoluteUrl(item, baseUrl))
        .filter(Boolean)
        .filter((url) => !/blank|placeholder|transparent|sprite|logo|badge|verified-agent|youtube-thumbnail|partners\/|download-on-the|app-store|google\.com\/intl|\.svg(?:[?#]|$)|\/properties\/branded\//i.test(url))
    )
  ).slice(0, 12);
}

function parseSrcsetCandidates(value) {
  return normalizeText(value)
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function isImageLikeUrl(value) {
  return /\.(?:jpe?g|png|webp|gif)(?:[?#].*)?$/i.test(normalizeText(value));
}

function parsePriceNumeric(priceText) {
  const raw = normalizeText(priceText).toLowerCase();
  if (!raw) return 0;

  const cleaned = raw.replace(/[,\s]/g, '');
  const match = cleaned.match(/(\d+(?:\.\d+)?)(billion|bn|million|m|thousand|k)?/i);
  if (!match) return 0;

  let amount = Number(match[1]);
  if (!Number.isFinite(amount)) return 0;

  const suffix = match[2] || '';
  if (suffix === 'billion' || suffix === 'bn') amount *= 1000000000;
  if (suffix === 'million' || suffix === 'm') amount *= 1000000;
  if (suffix === 'thousand' || suffix === 'k') amount *= 1000;

  return Math.round(amount);
}

function isUsablePrice(priceNumeric) {
  return Number.isFinite(priceNumeric) && priceNumeric > 1;
}

function parseExplicitDate(rawValue) {
  const raw = normalizeText(rawValue);
  if (!raw) return null;

  const value = raw
    .toLowerCase()
    .replace(/promoted|vip|top|added on|posted on|posted|updated|date|on:/g, ' ')
    .replace(/[|,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!value) return null;

  const now = new Date();
  if (value.includes('today') || value.includes('just now')) return now;
  if (value.includes('yesterday')) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return date;
  }

  const relativeMatch = value.match(/(\d+)\s*(minute|min|hour|hr|day|week|month|year)s?\s*ago/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    if (!Number.isFinite(amount) || amount < 0) return null;
    const unit = relativeMatch[2];
    const date = new Date(now);
    if (unit.startsWith('min')) date.setMinutes(date.getMinutes() - amount);
    if (unit === 'hour' || unit === 'hr') date.setHours(date.getHours() - amount);
    if (unit === 'day') date.setDate(date.getDate() - amount);
    if (unit === 'week') date.setDate(date.getDate() - amount * 7);
    if (unit === 'month') date.setMonth(date.getMonth() - amount);
    if (unit === 'year') date.setFullYear(date.getFullYear() - amount);
    return date;
  }

  const ddMmYyyyMatch = value.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (ddMmYyyyMatch) {
    const date = new Date(
      parseInt(ddMmYyyyMatch[3], 10),
      parseInt(ddMmYyyyMatch[2], 10) - 1,
      parseInt(ddMmYyyyMatch[1], 10)
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const monthNameMatch = value.match(
    /\b(\d{1,2})\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{4})\b/
  );
  if (monthNameMatch) {
    const monthMap = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
      may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
      september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
    };
    const month = monthMap[monthNameMatch[2]];
    const date = new Date(parseInt(monthNameMatch[3], 10), month, parseInt(monthNameMatch[1], 10));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinRecentWindow(dateValue, maxAgeDays = DEFAULT_MAX_AGE_DAYS) {
  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) return false;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - Math.max(1, Number(maxAgeDays) || DEFAULT_MAX_AGE_DAYS));
  return dateValue >= cutoff && dateValue <= new Date();
}

function resolvePostedAt(rawValue, options = {}) {
  const parsed = parseExplicitDate(rawValue);
  const maxAgeDays = options.maxAgeDays || DEFAULT_MAX_AGE_DAYS;
  if (parsed) {
    return {
      date: parsed,
      confidence: 'explicit',
      isRecent: isWithinRecentWindow(parsed, maxAgeDays)
    };
  }

  return {
    date: new Date(),
    confidence: 'fallback_now',
    isRecent: true
  };
}

function extractPhoneNumbers(text) {
  const value = normalizeText(text);
  if (!value) return [];

  const matches = value.match(/(?:\+?234|0)\s?\d{3}\s?\d{3}\s?\d{4}/g) || [];
  return Array.from(
    new Set(
      matches
        .map((phone) => phone.replace(/[^\d+]/g, ''))
        .map((phone) => {
          if (phone.startsWith('+234')) return phone;
          if (phone.startsWith('234')) return `+${phone}`;
          if (phone.startsWith('0')) return `+234${phone.slice(1)}`;
          return phone;
        })
    )
  ).slice(0, 3);
}

function loadCheerio() {
  try {
    return require('cheerio');
  } catch (error) {
    throw new Error(`Cheerio is required for scraper parsing: ${error.message}`);
  }
}

async function fetchHtmlWithRetry(url, options = {}) {
  const timeout = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const retries = Math.max(0, Number(options.retries ?? DEFAULT_RETRIES));
  const baseDelayMs = Math.max(0, Number(options.delayMs || 0));
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (baseDelayMs > 0 || attempt > 0) {
      await sleep(baseDelayMs + attempt * randomInt(400, 1200));
    }

    try {
      const response = await axios.get(url, {
        timeout,
        responseType: 'text',
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 500,
        headers: {
          'User-Agent': options.userAgent || pickUserAgent(),
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          Referer: options.referer || undefined
        }
      });

      if (response.status >= 200 && response.status < 300) {
        return String(response.data || '');
      }

      lastError = new Error(`HTTP ${response.status}`);
      if ([403, 429].includes(response.status) && options.curlFallback !== false && process.env.SCRAPER_CURL_FALLBACK !== 'false') {
        try {
          return await fetchHtmlWithCurl(url, options);
        } catch (curlError) {
          lastError = curlError;
        }
      }
      if (response.status < 429 && response.status < 500) break;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`request failed for ${url}: ${lastError?.message || 'unknown error'}`);
}

function fetchHtmlWithCurl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutSeconds = Math.max(5, Math.ceil(Number(options.timeoutMs || DEFAULT_TIMEOUT_MS) / 1000));
    const args = [
      '-L',
      '--silent',
      '--show-error',
      '--compressed',
      '--max-time',
      String(timeoutSeconds),
      '-A',
      options.userAgent || pickUserAgent(),
      '-H',
      'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      '-H',
      'Accept-Language: en-US,en;q=0.9',
      '-H',
      'Upgrade-Insecure-Requests: 1'
    ];

    if (options.referer) {
      args.push('-e', options.referer);
    }

    args.push(url);

    const child = spawn('curl', args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    const killTimer = setTimeout(() => {
      child.kill('SIGKILL');
    }, (timeoutSeconds + 5) * 1000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > 10 * 1024 * 1024) {
        child.kill('SIGKILL');
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(killTimer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(killTimer);
      if (code !== 0) {
        reject(new Error(`curl fallback failed (${code}): ${normalizeText(stderr).slice(0, 240)}`));
        return;
      }
      if (!stdout || /cf-challenge|Attention Required|Just a moment/i.test(stdout.slice(0, 5000))) {
        reject(new Error('curl fallback received an anti-bot challenge page'));
        return;
      }
      resolve(stdout);
    });
  });
}

async function mapLimit(items, limit, worker) {
  const source = Array.isArray(items) ? items : [];
  const concurrency = Math.max(1, Math.min(Number(limit) || 1, 8));
  const results = [];
  let cursor = 0;

  async function run() {
    while (cursor < source.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(source[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, source.length) }, run));
  return results;
}

function firstText($, root, selectors) {
  for (const selector of selectors) {
    const text = normalizeText($(root).find(selector).first().text());
    if (text) return text;
  }
  return '';
}

function firstAttr($, root, selectors, attr) {
  for (const selector of selectors) {
    const value = normalizeText($(root).find(selector).first().attr(attr));
    if (value) return value;
  }
  return '';
}

function collectImageUrls($, root, baseUrl) {
  const urls = [];
  $(root).find('img, source, a[href]').each((_, image) => {
    const node = $(image);
    const href = node.attr('href');
    urls.push(
      node.attr('data-src'),
      node.attr('data-original'),
      node.attr('data-lazy-src'),
      node.attr('data-full'),
      node.attr('data-large'),
      node.attr('data-image'),
      node.attr('data-zoom-image'),
      node.attr('src'),
      isImageLikeUrl(href) ? href : '',
      ...parseSrcsetCandidates(node.attr('srcset')),
      ...parseSrcsetCandidates(node.attr('data-srcset'))
    );
  });

  $(root).find('meta[property="og:image"], meta[name="twitter:image"]').each((_, meta) => {
    urls.push($(meta).attr('content'));
  });

  const styleUrls = String($(root).html() || '').match(/url\((['"]?)(.*?)\1\)/gi) || [];
  styleUrls.forEach((styleUrl) => {
    const match = styleUrl.match(/url\((['"]?)(.*?)\1\)/i);
    if (match?.[2]) urls.push(match[2]);
  });

  return normalizeImageUrls(urls, baseUrl);
}

module.exports = {
  DEFAULT_MAX_AGE_DAYS,
  collectImageUrls,
  extractPhoneNumbers,
  fetchHtmlWithRetry,
  fetchHtmlWithCurl,
  firstAttr,
  firstText,
  isUsablePrice,
  isWithinRecentWindow,
  loadCheerio,
  mapLimit,
  normalizeImageUrls,
  normalizeText,
  parsePriceNumeric,
  resolvePostedAt,
  sleep,
  stripHtml,
  toAbsoluteUrl
};
