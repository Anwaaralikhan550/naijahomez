const MAX_LISTED_TITLES = 3;

function firstName(agentName) {
  const cleaned = String(agentName || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const first = cleaned.split(' ')[0];
  if (first.length < 2 || first.length > 20) return '';
  return first;
}

function greeting(agentName) {
  const name = firstName(agentName);
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
