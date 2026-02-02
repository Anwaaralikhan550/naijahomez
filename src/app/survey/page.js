'use client';

import { useState, useCallback } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import SurveySignatureSection from '@/components/survey/SurveySignatureSection';
import ReportsList from '@/components/survey/ReportsList';
import { generateAndPersistPDF } from '@/lib/survey-pdf-generator';

/**
 * Survey Page — Full workflow:
 *
 *   1. Capture multiple signatures (append-only, never overwrite)
 *   2. Generate PDF → persisted to IndexedDB (survives restarts)
 *   3. Metadata synced to Firestore (cloud history)
 *   4. "Saved Reports" section: View, Download, Share, Delete
 *
 * Architecture change vs. previous version:
 *   BEFORE: downloadSurveyPDF() → fire-and-forget browser download, blob GC'd
 *   NOW:    generateAndPersistPDF() → IDB + Firestore + optional download
 */
export default function SurveyPage() {
  const [signatures, setSignatures] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [reportsKey, setReportsKey] = useState(0); // force ReportsList refresh

  // In production, this would come from a real survey form + surveyId from Firestore
  const surveyId = 'demo-survey-001';

  const surveyData = {
    title: 'Property Survey Report',
    surveyorName: 'NijaHomzs Surveyor',
    address: 'Lagos, Nigeria',
    date: new Date().toLocaleDateString(),
    description:
      'Comprehensive property survey including structural assessment, boundary verification, and valuation report.',
    fields: {
      propertyType: 'Residential',
      plotSize: '500 sqm',
      structuralCondition: 'Good',
      roofCondition: 'Fair — minor repairs needed',
      plumbingStatus: 'Functional',
      electricalStatus: 'Compliant',
      boundaryStatus: 'Verified — matches title deed',
      estimatedValue: '\u20A645,000,000',
    },
  };

  const handleSignaturesChange = useCallback((newSignatures) => {
    setSignatures(newSignatures);
  }, []);

  // ── Generate + Persist ─────────────────────────────────────────
  const handleGeneratePDF = async () => {
    setGenerating(true);
    setLastResult(null);
    try {
      const result = await generateAndPersistPDF({
        surveyData: { ...surveyData, signatures },
        surveyId,
        alsoDownload: true,
        // In production, pass the auth token:
        // authToken: await auth.currentUser.getIdToken(),
      });
      setLastResult(result);
      // Bump key to force ReportsList to re-read IndexedDB
      setReportsKey((k) => k + 1);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // ── Delete from Firestore (called by ReportsList) ──────────────
  const handleDeleteRemote = async (reportId) => {
    try {
      // In production, pass the auth token:
      // const token = await auth.currentUser.getIdToken();
      await fetch(`/api/survey/reports?reportId=${reportId}`, {
        method: 'DELETE',
        // headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.warn('Failed to delete remote report metadata:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="text-blue-600" size={24} />
            Property Survey
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Capture signatures, generate PDFs, and manage saved reports.
          </p>
        </div>

        {/* Signature capture */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <SurveySignatureSection
            signatures={signatures}
            onSignaturesChange={handleSignaturesChange}
            maxSignatures={20}
          />
        </div>

        {/* PDF generation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-800">Generate Report</h3>

          <p className="text-sm text-gray-500">
            The PDF will include <strong>all {signatures.length}</strong>{' '}
            saved signature{signatures.length !== 1 ? 's' : ''} and will be
            <strong> permanently saved</strong> in your browser for later access.
          </p>

          <button
            onClick={handleGeneratePDF}
            disabled={signatures.length === 0 || generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download size={16} />
                Generate & Save PDF ({signatures.length} sig{signatures.length !== 1 ? 's' : ''})
              </>
            )}
          </button>

          {lastResult && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              Saved: <strong>{lastResult.filename}</strong> (v{lastResult.version},{' '}
              {(lastResult.sizeBytes / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        {/* ── Saved Reports section (the key missing piece) ───────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <ReportsList
            key={reportsKey}
            surveyId={surveyId}
            onDeleteRemote={handleDeleteRemote}
          />
        </div>
      </div>
    </div>
  );
}
