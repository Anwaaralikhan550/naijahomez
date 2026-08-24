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

// Evolution rejects requests without an Origin it recognises, so every call
// has to carry the same header the send path uses.
async function evolutionRequest(pathname) {
  const { apiUrl, apiKey } = getEvolutionConfig();

  const response = await fetch(`${apiUrl}${pathname}`, {
    headers: {
      apikey: apiKey,
      Origin: process.env.EVOLUTION_HEALTH_ORIGIN || 'http://127.0.0.1:3000'
    },
    cache: 'no-store'
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.response?.message || payload?.message || payload?.error ||
      `Evolution API request failed with status ${response.status}`;
    const err = new Error(Array.isArray(message) ? message.join(', ') : message);
    err.details = payload;
    throw err;
  }

  return payload;
}

// 'open' means the linked device is live. 'close' means WhatsApp dropped it --
// on 2026-08-19 that happened with reason device_removed, and every send failed
// with "Connection Closed" until the device was re-linked.
async function getEvolutionConnectionState() {
  const { instanceName } = getEvolutionConfig();
  const payload = await evolutionRequest(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
  return {
    instanceName,
    state: payload?.instance?.state || 'unknown'
  };
}

async function getEvolutionInstanceDetails() {
  const { instanceName } = getEvolutionConfig();
  const payload = await evolutionRequest('/instance/fetchInstances');
  const list = Array.isArray(payload) ? payload : [];
  const instance = list.find((entry) => entry?.name === instanceName) || null;
  if (!instance) return null;

  let disconnectReason = null;
  try {
    const parsed = JSON.parse(instance.disconnectionObject || 'null');
    disconnectReason = parsed?.error?.data?.attrs?.type ||
      parsed?.error?.output?.payload?.message ||
      null;
  } catch {}

  return {
    instanceName,
    connectionStatus: instance.connectionStatus || 'unknown',
    ownerJid: instance.ownerJid || null,
    profileName: instance.profileName || null,
    disconnectionAt: instance.disconnectionAt || null,
    disconnectionReasonCode: instance.disconnectionReasonCode ?? null,
    disconnectReason
  };
}

// Starts a pairing attempt and returns a QR that is only valid for a short
// window, so it must be fetched at the moment someone is ready to scan.
async function requestEvolutionPairing() {
  const { instanceName } = getEvolutionConfig();
  const payload = await evolutionRequest(`/instance/connect/${encodeURIComponent(instanceName)}`);
  return {
    instanceName,
    qrBase64: payload?.base64 || null,
    qrCode: payload?.code || null,
    pairingCode: payload?.pairingCode || null,
    count: payload?.count ?? null
  };
}

module.exports = {
  getEvolutionConfig,
  getEvolutionConnectionState,
  getEvolutionInstanceDetails,
  normalizeRecipientNumber,
  requestEvolutionPairing,
  sendEvolutionTextMessage,
  sendWhatsAppTextMessage
};
