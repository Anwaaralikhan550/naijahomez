'use client';

/**
 * PDF Storage — Local-first persistence via IndexedDB + Firestore metadata.
 *
 * ─── WHY THIS EXISTS ──────────────────────────────────────────────
 *
 * The previous system called jsPDF's `doc.save()` which triggers a
 * one-shot browser download. The blob was immediately garbage-collected.
 * There was:
 *   - No way to retrieve the PDF later
 *   - No history of generated reports
 *   - No way to re-share or re-view without regenerating
 *
 * ─── ARCHITECTURE ─────────────────────────────────────────────────
 *
 *   LOCAL LAYER (IndexedDB — "pdfReportsDB"):
 *     Stores the actual PDF BLOB. IndexedDB handles binary data
 *     natively and has no practical size limit (browser-managed quota,
 *     typically hundreds of MB). Survives page reloads, tab closes,
 *     and browser restarts. This is the local-first persistence.
 *
 *   METADATA LAYER (Firestore — "surveyReports" collection):
 *     Stores a lightweight record per PDF:
 *       { id, surveyId, title, filename, version, sizeBytes,
 *         signatureCount, createdBy, createdAt }
 *     Does NOT store the blob — Firestore docs have a 1 MiB limit
 *     and base64 PDFs far exceed that. The blob lives only in IDB.
 *
 *   SYNC STRATEGY:
 *     - On generate: blob → IDB, metadata → Firestore
 *     - On list:     metadata from Firestore (or IDB fallback offline)
 *     - On view:     blob from IDB (instant, no network)
 *     - On delete:   remove from both IDB and Firestore
 *
 *   This is "local-first" — the app works fully offline for viewing
 *   and deleting PDFs. Firestore is the secondary sync layer.
 */

const DB_NAME = 'pdfReportsDB';
const DB_VERSION = 1;
const STORE_NAME = 'reports';

// ── IndexedDB helpers ────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('surveyId', 'surveyId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbTransaction(mode, callback) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const result = callback(store);

        tx.oncomplete = () => {
          db.close();
          resolve(result._result ?? result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };

        // For get/getAll requests, capture async result
        if (result instanceof IDBRequest) {
          result.onsuccess = () => {
            result._result = result.result;
          };
        }
      })
  );
}

// ── Public API ───────────────────────────────────────────────────

/**
 * @typedef {Object} PDFReportRecord
 * @property {string}  id              - UUID
 * @property {string}  surveyId        - linked survey
 * @property {string}  title           - human-readable title
 * @property {string}  filename        - e.g. "survey-report-1706380000000.pdf"
 * @property {number}  version         - auto-incremented per survey
 * @property {number}  sizeBytes       - blob size
 * @property {number}  signatureCount  - number of signatures embedded
 * @property {string}  createdAt       - ISO-8601
 * @property {Blob}    [blob]          - the actual PDF (IDB only, not in Firestore)
 */

/**
 * Save a generated PDF blob + metadata to IndexedDB.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.surveyId
 * @param {string} params.title
 * @param {string} params.filename
 * @param {number} params.version
 * @param {number} params.signatureCount
 * @param {Blob}   params.blob
 * @returns {Promise<PDFReportRecord>}
 */
export async function saveReportLocally({ id, surveyId, title, filename, version, signatureCount, blob }) {
  const record = {
    id,
    surveyId,
    title,
    filename,
    version,
    sizeBytes: blob.size,
    signatureCount,
    createdAt: new Date().toISOString(),
    blob, // Stored as native Blob in IDB (not base64)
  };

  await idbTransaction('readwrite', (store) => store.put(record));
  return record;
}

/**
 * Get all PDF report records from IndexedDB, sorted newest-first.
 *
 * @param {string} [surveyId] - optional filter
 * @returns {Promise<PDFReportRecord[]>}
 */
export async function listReportsLocally(surveyId = null) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    let request;
    if (surveyId) {
      const index = store.index('surveyId');
      request = index.getAll(surveyId);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      const records = request.result || [];
      // Sort newest first
      records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      // Strip blobs from listing (too large to hold in React state)
      const lightweight = records.map(({ blob, ...meta }) => ({
        ...meta,
        hasBlob: !!blob,
      }));
      db.close();
      resolve(lightweight);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Retrieve the full record (including blob) for one report.
 *
 * @param {string} reportId
 * @returns {Promise<PDFReportRecord|null>}
 */
export async function getReportLocally(reportId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(reportId);

    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Delete a single report from IndexedDB.
 *
 * @param {string} reportId
 * @returns {Promise<void>}
 */
export async function deleteReportLocally(reportId) {
  await idbTransaction('readwrite', (store) => store.delete(reportId));
}

/**
 * Get the next version number for a survey's reports.
 *
 * @param {string} surveyId
 * @returns {Promise<number>}
 */
export async function getNextVersion(surveyId) {
  const reports = await listReportsLocally(surveyId);
  if (reports.length === 0) return 1;
  const maxVersion = Math.max(...reports.map((r) => r.version || 0));
  return maxVersion + 1;
}

/**
 * Trigger a browser download for a stored report.
 *
 * @param {string} reportId
 * @returns {Promise<boolean>} - true if download started
 */
export async function downloadStoredReport(reportId) {
  const record = await getReportLocally(reportId);
  if (!record || !record.blob) return false;

  const url = URL.createObjectURL(record.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = record.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke after a short delay to ensure download starts
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

/**
 * Open a stored report in a new browser tab for preview.
 *
 * @param {string} reportId
 * @returns {Promise<boolean>}
 */
export async function previewStoredReport(reportId) {
  const record = await getReportLocally(reportId);
  if (!record || !record.blob) return false;

  const url = URL.createObjectURL(record.blob);
  window.open(url, '_blank');

  // Revoke after generous delay
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

/**
 * Share a stored report via the Web Share API (mobile-friendly).
 * Falls back to download if sharing is not supported.
 *
 * @param {string} reportId
 * @returns {Promise<boolean>}
 */
export async function shareStoredReport(reportId) {
  const record = await getReportLocally(reportId);
  if (!record || !record.blob) return false;

  if (navigator.share && navigator.canShare) {
    const file = new File([record.blob], record.filename, { type: 'application/pdf' });
    const shareData = { title: record.title, files: [file] };

    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return true;
      } catch (err) {
        if (err.name === 'AbortError') return false; // User cancelled
        // Fall through to download
      }
    }
  }

  // Fallback — trigger download
  return downloadStoredReport(reportId);
}
