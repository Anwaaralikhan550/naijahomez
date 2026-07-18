function getEvolutionConfig() {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

  if (!apiUrl) {
    throw new Error('EVOLUTION_API_URL is missing. Set it in your environment.');
  }

  if (!apiKey) {
    throw new Error('EVOLUTION_API_KEY is missing. Set it in your environment.');
  }

  if (!instanceName) {
    throw new Error('EVOLUTION_INSTANCE_NAME is missing. Set it in your environment.');
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    apiKey,
    instanceName
  };
}

function normalizeRecipientNumber(to) {
  const digits = String(to || '').replace(/\D/g, '');
  if (!digits) {
    throw new Error('Recipient phone number "to" is required.');
  }
  return digits;
}

async function sendEvolutionTextMessage({ to, text, previewUrl = false, delay = 0 }) {
  if (!text || !text.trim()) {
    throw new Error('Message text is required.');
  }

  const { apiUrl, apiKey, instanceName } = getEvolutionConfig();
  const url = `${apiUrl}/message/sendText/${encodeURIComponent(instanceName)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
      Origin: process.env.EVOLUTION_HEALTH_ORIGIN || 'http://127.0.0.1:3000'
    },
    body: JSON.stringify({
      number: normalizeRecipientNumber(to),
      text,
      options: {
        delay,
        presence: 'composing',
        linkPreview: Boolean(previewUrl)
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage =
      payload?.message ||
      payload?.error ||
      `Evolution API request failed with status ${response.status}`;
    const err = new Error(Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage);
    err.details = payload;
    throw err;
  }

  return payload;
}

async function sendWhatsAppTextMessage(options) {
  return sendEvolutionTextMessage(options);
}

module.exports = {
  getEvolutionConfig,
  normalizeRecipientNumber,
  sendEvolutionTextMessage,
  sendWhatsAppTextMessage
};
