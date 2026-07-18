import { auth } from '@/lib/firebase-client';

function createDraftId() {
  const bytes = new Uint8Array(15);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
    .slice(0, 20);
}

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required');
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

export async function createDraft(data = {}) {
  const draftId = createDraftId();
  await updateDraft(draftId, data);
  return { id: draftId };
}

export async function getDraft(draftId) {
  const response = await fetch(`/api/drafts/${encodeURIComponent(draftId)}`, {
    headers: await getAuthHeaders()
  });

  if (response.status === 404) {
    return { exists: false, id: draftId, data: null };
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || 'Failed to load draft');
  }

  return {
    exists: Boolean(payload.exists),
    id: payload.draft?.id || draftId,
    data: payload.draft || null
  };
}

export async function updateDraft(draftId, patch = {}) {
  const response = await fetch(`/api/drafts/${encodeURIComponent(draftId)}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(patch)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || 'Failed to save draft');
  }

  return {
    exists: true,
    id: payload.draft?.id || draftId,
    data: payload.draft || null
  };
}

export async function deleteDraft(draftId) {
  const response = await fetch(`/api/drafts/${encodeURIComponent(draftId)}`, {
    method: 'DELETE',
    headers: await getAuthHeaders()
  });

  if (response.status === 404) return { success: true };

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || 'Failed to delete draft');
  }

  return payload;
}
