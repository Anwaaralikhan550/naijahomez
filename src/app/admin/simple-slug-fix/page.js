'use client';
import { useState } from 'react';
import { generateDocumentSlug } from '@/utils/slugify';
import { Copy, Check } from 'lucide-react';

export default function SimpleSlugFixPage() {
  const [propertyId, setPropertyId] = useState('');
  const [title, setTitle] = useState('');
  const [generatedSlug, setGeneratedSlug] = useState('');
  const [copied, setCopied] = useState(false);

  const generateSlug = () => {
    if (propertyId && title) {
      const slug = generateDocumentSlug(title, propertyId);
      setGeneratedSlug(slug);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedSlug);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Simple Slug Generator</h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Property ID
              </label>
              <input
                type="text"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                placeholder="e.g., abc12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Get this from Firebase Console or the duplicate slugs list
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Property Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., 3 bedroom flat apartment for rent"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={generateSlug}
              disabled={!propertyId || !title}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Unique Slug
            </button>

            {generatedSlug && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800 mb-1">Generated Slug:</p>
                    <p className="font-mono text-sm text-green-900 bg-white px-2 py-1 rounded border">
                      {generatedSlug}
                    </p>
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="ml-4 p-2 text-green-600 hover:bg-green-100 rounded"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {generatedSlug && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Next Steps:</h3>
              <ol className="text-sm text-blue-700 space-y-1">
                <li>1. Copy the generated slug above</li>
                <li>2. Go to <a href="https://console.firebase.google.com/project/nijahomzs-1ead3/firestore" target="_blank" rel="noopener noreferrer" className="underline">Firebase Console</a></li>
                <li>3. Navigate to: Firestore Database → properties → {propertyId}</li>
                <li>4. Edit the "slug" field and paste the new slug</li>
                <li>5. Save the changes</li>
                <li>6. Clear cache: <a href="/api/cache/clear" target="_blank" rel="noopener noreferrer" className="underline">Click here</a></li>
              </ol>
            </div>
          )}

          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">How to Find Duplicate Slugs:</h3>
            <div className="text-sm text-yellow-700 space-y-2">
              <p>Run this in your terminal to see duplicates:</p>
              <code className="block bg-white px-2 py-1 rounded font-mono text-xs">
                node scripts/manual-slug-fixer.js --list-duplicates
              </code>
              <p>Then use this tool to generate unique slugs for each duplicate.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}