const MAX_LISTED_TITLES = 3;

// agent_name is scraped from the source listing and is almost always an
// agency name ("360 DEGREE PROPERTIES LTD", "Abbey & Co"), not a person's.
// Taking the first word produces greetings like "Hi 360," or "Hi 1a1m,", so
// the whole cleaned business name is used, or none at all.
const GENERIC_AGENT_NAMES = new Set([
  'agent', 'agents', 'owner', 'owners', 'landlord', 'landlady',
  'estate agent', 'property agent', 'realtor', 'admin', 'n/a', 'none'
]);

const MAX_GREETING_NAME_LENGTH = 40;

function cleanAgentName(agentName) {
  let cleaned = String(agentName || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  // Several scraped names carry a trailing contact number.
  cleaned = cleaned.replace(/[\s,-]*\+?\d[\d\s-]{6,}$/, '').trim();
  // Trailing separators left behind by the strip above.
  cleaned = cleaned.replace(/[.,\-&|]+$/, '').trim();

  if (cleaned.length < 3 || cleaned.length > MAX_GREETING_NAME_LENGTH) return '';
  if (!/[a-z]/i.test(cleaned)) return '';
  if (GENERIC_AGENT_NAMES.has(cleaned.toLowerCase())) return '';
  // Handles/usernames read worse than no name at all.
  if (/[_@]/.test(cleaned)) return '';

  // Shouty scraped names get title-cased; mixed-case names are left alone.
  if (cleaned === cleaned.toUpperCase()) {
    cleaned = cleaned
      .toLowerCase()
      .replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }

  return cleaned;
}

function greeting(agentName) {
  const name = cleanAgentName(agentName);
  return name ? `Hi ${name},` : 'Hi,';
}

function propertyLine({ title, location, price }) {
  const lines = [`*${title || 'Your property'}*`];
  const details = [location, price].filter(Boolean).join(' · ');
  if (details) lines.push(details);
  return lines.join('\n');
}

function generateListingClaimMessage({ title, location, price, agentName, claimUrl, manageUrl }) {
  const actionUrl = manageUrl || claimUrl;

  return `${greeting(agentName)}

We found your property advert and published it free on Nijahomzs:

${propertyLine({ title, location, price })}

Open it here to view, update, or remove it:
${actionUrl}

Viewing and removing needs no login. Claim it with a free account to edit the details and receive buyer enquiries directly.

- Nijahomzs`;
}

function generateBatchListingClaimMessage({ count = 1, adverts = [], agentName, claimUrl, manageUrl }) {
  const safeCount = Math.max(1, Number(count) || 1);
  const advertText = safeCount === 1 ? 'property advert' : 'property adverts';
  const actionUrl = manageUrl || claimUrl;

  const listed = adverts.slice(0, MAX_LISTED_TITLES).map((advert, index) => {
    const location = advert?.location ? ` - ${advert.location}` : '';
    return `${index + 1}. ${advert?.title || 'Property listing'}${location}`;
  });
  const remaining = safeCount - listed.length;
  if (remaining > 0) listed.push(`...and ${remaining} more`);

  const summary = listed.length ? `\n${listed.join('\n')}\n` : '';

  return `${greeting(agentName)}

We found ${safeCount} of your ${advertText} and published ${safeCount === 1 ? 'it' : 'them'} free on Nijahomzs:
${summary}
Open ${safeCount === 1 ? 'it' : 'them'} here to view, update, or remove any of them:
${actionUrl}

Viewing and removing needs no login. Claim ${safeCount === 1 ? 'it' : 'them'} with a free account to edit the details and receive buyer enquiries directly.

- Nijahomzs`;
}

function generateReminderMessage({ stage, title, location, price, agentName, count = 1, manageUrl, claimUrl, expiresInDays }) {
  const actionUrl = manageUrl || claimUrl;
  const safeCount = Math.max(1, Number(count) || 1);
  const many = safeCount > 1;
  const subject = many
    ? `your ${safeCount} property adverts on Nijahomzs are still unclaimed`
    : 'your property advert on Nijahomzs is still unclaimed';

  // Naming one property under a multi-advert reminder reads as if that is the
  // only one, so the detail block is single-advert only.
  const detailBlock = many ? '' : `\n${propertyLine({ title, location, price })}\n`;

  if (stage === 'final') {
    const expiryLine = Number.isFinite(expiresInDays) && expiresInDays > 0
      ? `\nThis link stops working in ${expiresInDays} day${expiresInDays === 1 ? '' : 's'}.\n`
      : '';

    return `${greeting(agentName)}

Last reminder - ${subject}.
${detailBlock}${expiryLine}
Claim ${many ? 'them' : 'it'} free to manage the ${many ? 'listings' : 'listing'} and receive buyer enquiries, or remove ${many ? 'them' : 'it'} if you would rather not be listed:
${actionUrl}

- Nijahomzs`;
  }

  return `${greeting(agentName)}

Quick reminder - ${subject}.
${detailBlock}
Claim ${many ? 'them' : 'it'} free to edit the details and receive buyer enquiries directly, or remove ${many ? 'them' : 'it'} if you would rather not be listed:
${actionUrl}

- Nijahomzs`;
}

module.exports = {
  generateBatchListingClaimMessage,
  generateListingClaimMessage,
  generateReminderMessage
};
