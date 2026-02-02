'use client';

import { useState } from 'react';
import { Trash2, Eye, EyeOff, Clock, AlertCircle } from 'lucide-react';

/**
 * SavedSignaturesList - Displays all captured signatures with review / delete.
 *
 * Each signature object must have at minimum:
 *   { id: string, imageData: string (base64), timestamp: string, label?: string }
 *
 * Architecture:
 *   - Purely presentational; mutation is delegated to the parent via callbacks.
 *   - Supports an optional "review" mode that enlarges the signature.
 *   - Delete requires a confirmation tap to prevent accidental removal.
 */
export default function SavedSignaturesList({ signatures = [], onDelete, disabled = false }) {
  const [reviewId, setReviewId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  if (signatures.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm italic border border-dashed border-gray-200 rounded-lg">
        No signatures saved yet. Draw and save a signature above.
      </div>
    );
  }

  const handleDeleteClick = (id) => {
    if (confirmDeleteId === id) {
      // Second click — actually delete
      onDelete?.(id);
      setConfirmDeleteId(null);
    } else {
      // First click — arm confirmation
      setConfirmDeleteId(id);
      // Auto-disarm after 3 seconds
      setTimeout(() => setConfirmDeleteId((prev) => (prev === id ? null : prev)), 3000);
    }
  };

  const toggleReview = (id) => {
    setReviewId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        Saved Signatures
        <span className="inline-flex items-center justify-center bg-blue-100 text-blue-700 text-xs font-bold rounded-full w-5 h-5">
          {signatures.length}
        </span>
      </h4>

      <ul className="space-y-2">
        {signatures.map((sig, index) => {
          const isReviewing = reviewId === sig.id;
          const isConfirmingDelete = confirmDeleteId === sig.id;
          const formattedTime = sig.timestamp
            ? new Date(sig.timestamp).toLocaleString()
            : 'Unknown time';

          return (
            <li
              key={sig.id}
              className="border border-gray-200 rounded-lg bg-white overflow-hidden transition-all"
            >
              {/* Header row */}
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-800">
                    {sig.label || `Signature #${index + 1}`}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={12} />
                    {formattedTime}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Review toggle */}
                  <button
                    type="button"
                    onClick={() => toggleReview(sig.id)}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
                    title={isReviewing ? 'Hide preview' : 'Review signature'}
                  >
                    {isReviewing ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(sig.id)}
                    disabled={disabled}
                    className={`p-1.5 rounded transition-colors flex items-center gap-1 text-sm ${
                      isConfirmingDelete
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'hover:bg-gray-100 text-gray-500 hover:text-red-600'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={isConfirmingDelete ? 'Click again to confirm delete' : 'Delete signature'}
                  >
                    {isConfirmingDelete ? (
                      <>
                        <AlertCircle size={14} />
                        <span className="text-xs font-medium">Confirm?</span>
                      </>
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>

              {/* Thumbnail — always visible */}
              {!isReviewing && (
                <div className="px-3 pb-2">
                  <img
                    src={sig.imageData}
                    alt={sig.label || `Signature ${index + 1}`}
                    className="h-12 w-auto rounded border border-gray-100 bg-gray-50 object-contain"
                  />
                </div>
              )}

              {/* Full-size review panel */}
              {isReviewing && (
                <div className="border-t border-gray-100 bg-gray-50 p-3 flex justify-center">
                  <img
                    src={sig.imageData}
                    alt={sig.label || `Signature ${index + 1}`}
                    className="max-w-full h-auto rounded border border-gray-200 bg-white"
                    style={{ maxHeight: 200 }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
