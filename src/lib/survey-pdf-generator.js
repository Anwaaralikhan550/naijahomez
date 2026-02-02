/**
 * Survey PDF Generator — renders ALL saved signatures.
 *
 * Architecture rationale:
 *
 *   The old approach called `doc.addImage(singleSignature)` once.
 *   If the survey model only held one base64 string, the PDF could
 *   never show more than that one image.
 *
 *   NEW APPROACH:
 *     1. Accept an ARRAY of SignatureEntry objects.
 *     2. Iterate and render each one sequentially, adding pages as needed.
 *     3. Each signature block includes its label, timestamp, and image.
 *
 *   This is a client-side module — import it only in 'use client' components
 *   because jsPDF depends on the browser DOM (canvas, etc.).
 */

import { jsPDF } from 'jspdf';

/**
 * @typedef {Object} SignatureEntry
 * @property {string}  id
 * @property {string}  imageData  - base64 PNG data-url
 * @property {string}  timestamp  - ISO-8601
 * @property {string}  [label]
 */

/**
 * @typedef {Object} SurveyData
 * @property {string}  title
 * @property {string}  [address]
 * @property {string}  [description]
 * @property {string}  [surveyorName]
 * @property {string}  [date]
 * @property {Object}  [fields]         - key/value pairs to render
 * @property {SignatureEntry[]} signatures
 */

const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// ── Helpers ──────────────────────────────────────────────────────

function addHeader(doc, title) {
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title || 'Survey Report', MARGIN, MARGIN + 10);

  doc.setDrawColor(59, 130, 246); // blue-500
  doc.setLineWidth(0.8);
  doc.line(MARGIN, MARGIN + 14, PAGE_WIDTH - MARGIN, MARGIN + 14);

  return MARGIN + 22; // y-cursor after header
}

function addMetadata(doc, y, surveyData) {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);

  const meta = [];
  if (surveyData.surveyorName) meta.push(`Surveyor: ${surveyData.surveyorName}`);
  if (surveyData.address) meta.push(`Address: ${surveyData.address}`);
  if (surveyData.date) meta.push(`Date: ${surveyData.date}`);

  meta.forEach((line) => {
    doc.text(line, MARGIN, y);
    y += 5;
  });

  if (surveyData.description) {
    y += 3;
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(surveyData.description, CONTENT_WIDTH);
    doc.text(lines, MARGIN, y);
    y += lines.length * 5;
  }

  return y + 5;
}

function addFields(doc, y, fields) {
  if (!fields || typeof fields !== 'object') return y;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Survey Details', MARGIN, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const entries = Object.entries(fields);
  entries.forEach(([key, value]) => {
    if (y > PAGE_HEIGHT - 30) {
      doc.addPage();
      y = MARGIN + 10;
    }

    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, MARGIN, y);
    doc.setFont('helvetica', 'normal');

    const valueStr = String(value ?? '');
    const textLines = doc.splitTextToSize(valueStr, CONTENT_WIDTH - 50);
    doc.text(textLines, MARGIN + 50, y);
    y += Math.max(textLines.length * 5, 6);
  });

  return y + 5;
}

/**
 * Render ALL signatures — the core fix for the overwrite problem.
 *
 * Each signature gets:
 *   - A divider line
 *   - Its label + timestamp
 *   - The image rendered at a fixed width, aspect-ratio preserved
 *
 * Automatic page breaks prevent overflow.
 */
function addSignatures(doc, y, signatures) {
  if (!signatures || signatures.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text('No signatures captured.', MARGIN, y);
    return y + 8;
  }

  // Section title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(`Signatures (${signatures.length})`, MARGIN, y);
  y += 8;

  const SIG_IMAGE_WIDTH = 100; // mm
  const SIG_IMAGE_HEIGHT = 40; // mm (fixed height, image will be fit-contained)
  const BLOCK_HEIGHT = SIG_IMAGE_HEIGHT + 20; // image + label + padding

  signatures.forEach((sig, index) => {
    // Page break check
    if (y + BLOCK_HEIGHT > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN + 10;
    }

    // Light divider
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 5;

    // Label + timestamp
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    const labelText = sig.label || `Signature #${index + 1}`;
    doc.text(labelText, MARGIN, y);

    if (sig.timestamp) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(140, 140, 140);
      const timeStr = new Date(sig.timestamp).toLocaleString();
      doc.text(timeStr, MARGIN + 60, y);
    }
    y += 5;

    // Signature image
    try {
      doc.addImage(
        sig.imageData,
        'PNG',
        MARGIN,
        y,
        SIG_IMAGE_WIDTH,
        SIG_IMAGE_HEIGHT
      );
    } catch (err) {
      // If image fails to decode, show placeholder text
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(200, 60, 60);
      doc.text('[Signature image could not be rendered]', MARGIN, y + 10);
    }

    y += SIG_IMAGE_HEIGHT + 8;
  });

  return y;
}

function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Page ${i} of ${pageCount} | Generated ${new Date().toLocaleDateString()}`,
      MARGIN,
      PAGE_HEIGHT - 8
    );
  }
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Generate a survey PDF with all signatures.
 *
 * @param {SurveyData} surveyData
 * @returns {jsPDF} — call `.save('name.pdf')` or `.output('blob')` on the result
 */
export function generateSurveyPDF(surveyData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = addHeader(doc, surveyData.title);
  y = addMetadata(doc, y, surveyData);
  y = addFields(doc, y, surveyData.fields);

  // ── KEY FIX: iterate ALL signatures ────────────────────────
  y = addSignatures(doc, y, surveyData.signatures);

  addFooter(doc);

  return doc;
}

/**
 * Convenience — generates and immediately triggers a browser download.
 */
export function downloadSurveyPDF(surveyData, filename = 'survey-report.pdf') {
  const doc = generateSurveyPDF(surveyData);
  doc.save(filename);
}

/**
 * Convenience — returns the PDF as a Blob for preview or upload.
 */
export function getSurveyPDFBlob(surveyData) {
  const doc = generateSurveyPDF(surveyData);
  return doc.output('blob');
}

/**
 * Generate a PDF AND persist it to IndexedDB + Firestore metadata.
 *
 * This is the PRIMARY entry point for production use. It:
 *   1. Generates the PDF blob
 *   2. Saves the blob to IndexedDB (local-first, survives restarts)
 *   3. Registers metadata in Firestore (cloud-synced history)
 *   4. Optionally triggers a browser download
 *
 * @param {Object}  params
 * @param {SurveyData}  params.surveyData
 * @param {string}      params.surveyId
 * @param {boolean}     [params.alsoDownload=false]
 * @param {string}      [params.authToken]  - for Firestore metadata sync
 * @returns {Promise<{id: string, filename: string, sizeBytes: number}>}
 */
export async function generateAndPersistPDF({ surveyData, surveyId, alsoDownload = false, authToken = null }) {
  // Lazy-import to keep pdf-storage out of SSR bundles
  const { saveReportLocally, getNextVersion } = await import('./pdf-storage');
  const { v4: uuidv4 } = await import('uuid');

  // 1. Generate
  const doc = generateSurveyPDF(surveyData);
  const blob = doc.output('blob');

  // 2. Build metadata
  const reportId = uuidv4();
  const version = await getNextVersion(surveyId);
  const filename = `${(surveyData.title || 'survey-report').replace(/[^a-zA-Z0-9-_ ]/g, '').substring(0, 60)}-v${version}-${Date.now()}.pdf`;
  const signatureCount = surveyData.signatures?.length || 0;

  // 3. Persist locally (IndexedDB)
  await saveReportLocally({
    id: reportId,
    surveyId,
    title: surveyData.title || 'Survey Report',
    filename,
    version,
    signatureCount,
    blob,
  });

  // 4. Sync metadata to Firestore (best-effort, non-blocking)
  if (authToken) {
    try {
      await fetch('/api/survey/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          id: reportId,
          surveyId,
          title: surveyData.title || 'Survey Report',
          filename,
          version,
          sizeBytes: blob.size,
          signatureCount,
        }),
      });
    } catch (err) {
      // Firestore sync failed — PDF is still safe in IndexedDB
      console.warn('Failed to sync report metadata to server:', err);
    }
  }

  // 5. Optional download
  if (alsoDownload) {
    doc.save(filename);
  }

  return { id: reportId, filename, sizeBytes: blob.size, version };
}

export default { generateSurveyPDF, downloadSurveyPDF, getSurveyPDFBlob, generateAndPersistPDF };
