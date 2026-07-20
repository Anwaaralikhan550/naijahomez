function generateListingClaimMessage({ title, claimUrl, manageUrl }) {
  const actionUrl = manageUrl || claimUrl;
  const actionText = manageUrl
    ? 'Open your secure advert dashboard here'
    : 'Claim your advert here';

  return `Hello,
Your property advert "${title}" is now live on Nijahomzs.

${actionText}:
${actionUrl}

From there you can view the advert, delete it, or claim it without logging in.

Welcome to Nijahomzs!`;
}

function generateBatchListingClaimMessage({ count = 1, claimUrl }) {
  const safeCount = Math.max(1, Number(count) || 1);
  const advertText = safeCount === 1 ? 'property advert' : 'property adverts';

  return `Hello,
We found ${safeCount} of your ${advertText} now listed on Nijahomzs.

You can claim ${safeCount === 1 ? 'it' : 'them'}, edit details, and keep ${safeCount === 1 ? 'this listing' : 'these listings'} free here:
${claimUrl}

Welcome to Nijahomzs!`;
}

module.exports = {
  generateBatchListingClaimMessage,
  generateListingClaimMessage
};
