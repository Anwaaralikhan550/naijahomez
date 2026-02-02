'use client';

import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PenTool, Save, Eraser } from 'lucide-react';
import SignaturePad from './SignaturePad';
import SavedSignaturesList from './SavedSignaturesList';

/**
 * SurveySignatureSection - Top-level orchestrator for multi-signature capture.
 *
 * WHY THIS EXISTS (architecture rationale):
 *
 * The previous single-signature approach stored one `signatureData` string
 * on the survey document.  Every save _replaced_ that field, so:
 *   - Only the last signature survived.
 *   - There was no list to review or delete from.
 *   - The PDF renderer only had one image to embed.
 *
 * NEW DESIGN:
 *   - `signatures` is an ARRAY of objects, each with a unique `id`,
 *     a base64 `imageData` snapshot, a `timestamp`, and an optional `label`.
 *   - Saving a new signature APPENDS to the array (never overwrites).
 *   - Deleting removes only the targeted entry by `id`.
 *   - The PDF generator iterates the full array.
 *
 * BACKWARD COMPATIBILITY:
 *   - If the parent passes a legacy `legacySignatureData` string (the old
 *     single field), this component auto-migrates it into the array on mount.
 *   - External consumers receive the canonical array via `onSignaturesChange`.
 *
 * Props:
 *   signatures           - SignatureEntry[]   (controlled)
 *   onSignaturesChange   - (sigs: SignatureEntry[]) => void
 *   legacySignatureData  - string | null  (old single base64 — auto-migrated)
 *   maxSignatures        - number         (default 20)
 *   disabled             - boolean
 */

/**
 * @typedef {Object} SignatureEntry
 * @property {string}  id         - UUID
 * @property {string}  imageData  - base64 PNG data-url
 * @property {string}  timestamp  - ISO-8601
 * @property {string}  [label]    - optional human label
 */

export default function SurveySignatureSection({
  signatures: controlledSignatures = [],
  onSignaturesChange,
  legacySignatureData = null,
  maxSignatures = 20,
  disabled = false,
}) {
  // ── Internal state (uncontrolled fallback) ─────────────────────
  const [internalSignatures, setInternalSignatures] = useState(() => {
    // Backward compat: migrate a legacy single-signature string
    if (legacySignatureData && controlledSignatures.length === 0) {
      return [
        {
          id: uuidv4(),
          imageData: legacySignatureData,
          timestamp: new Date().toISOString(),
          label: 'Migrated signature',
        },
      ];
    }
    return controlledSignatures;
  });

  // Decide controlled vs uncontrolled
  const signatures = onSignaturesChange ? controlledSignatures : internalSignatures;
  const setSignatures = onSignaturesChange
    ? (next) => {
        const value = typeof next === 'function' ? next(controlledSignatures) : next;
        onSignaturesChange(value);
      }
    : setInternalSignatures;

  // Pad ref for imperative access
  const padRef = useRef(null);
  const [label, setLabel] = useState('');
  const [saveStatus, setSaveStatus] = useState(null); // 'saved' | 'empty' | null

  const handlePadRef = useCallback((ref) => {
    padRef.current = ref;
  }, []);

  // ── Save ───────────────────────────────────────────────────────
  const handleSave = () => {
    if (!padRef.current) return;

    if (padRef.current.isEmpty()) {
      setSaveStatus('empty');
      setTimeout(() => setSaveStatus(null), 2000);
      return;
    }

    if (signatures.length >= maxSignatures) {
      setSaveStatus('max');
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    const newEntry = {
      id: uuidv4(),
      imageData: padRef.current.toDataURL(),
      timestamp: new Date().toISOString(),
      label: label.trim() || `Signature #${signatures.length + 1}`,
    };

    setSignatures((prev) => [...prev, newEntry]);

    // Clear canvas + label for the next signature
    padRef.current.clear();
    setLabel('');
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  // ── Clear canvas (no save) ────────────────────────────────────
  const handleClear = () => {
    padRef.current?.clear();
    setSaveStatus(null);
  };

  // ── Delete one signature ──────────────────────────────────────
  const handleDelete = (id) => {
    setSignatures((prev) => prev.filter((s) => s.id !== id));
  };

  // ── Render ─────────────────────────────────────────────────────
  const atCapacity = signatures.length >= maxSignatures;

  return (
    <div className="space-y-5">
      {/* Drawing area */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <PenTool size={18} className="text-blue-600" />
          Capture Signature
        </h3>

        {/* Optional label */}
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Surveyor, Witness, Owner)"
          maxLength={80}
          disabled={disabled || atCapacity}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />

        {/* Signature pad */}
        <SignaturePad
          onRef={handlePadRef}
          width={500}
          height={200}
          disabled={disabled || atCapacity}
        />

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || atCapacity}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={16} />
            Save Signature
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Eraser size={16} />
            Clear
          </button>

          {/* Status feedback */}
          {saveStatus === 'saved' && (
            <span className="text-green-600 text-sm font-medium animate-pulse">
              Signature saved
            </span>
          )}
          {saveStatus === 'empty' && (
            <span className="text-amber-600 text-sm font-medium">
              Please draw a signature first
            </span>
          )}
          {saveStatus === 'max' && (
            <span className="text-red-600 text-sm font-medium">
              Maximum {maxSignatures} signatures reached
            </span>
          )}
        </div>

        {atCapacity && (
          <p className="text-xs text-amber-600">
            Maximum of {maxSignatures} signatures reached. Delete one to add another.
          </p>
        )}
      </div>

      {/* Saved signatures list */}
      <SavedSignaturesList
        signatures={signatures}
        onDelete={handleDelete}
        disabled={disabled}
      />
    </div>
  );
}
