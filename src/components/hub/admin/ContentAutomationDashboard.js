'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, FileText, Loader2, RefreshCw, Send, Sparkles, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { authenticatedFetch } from '@/services/api';

const statusClasses = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  review: 'bg-blue-50 text-blue-700 border-blue-200',
  scheduled: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200'
};

function StatusPill({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
      {status || 'unknown'}
    </span>
  );
}

function toLocalInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInputValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function referencesToText(references) {
  if (!Array.isArray(references)) return '';
  return references
    .map((source) => [source.title, source.url, source.note].filter(Boolean).join(' | '))
    .join('\n');
}

function parseSourceReferences(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim());
      if (parts.length === 1) {
        return { title: parts[0].replace(/^https?:\/\//i, '').replace(/\/$/, ''), url: parts[0], note: '' };
      }
      return {
        title: parts[0],
        url: parts[1],
        note: parts.slice(2).join(' | ')
      };
    });
}

export default function ContentAutomationDashboard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [socialQueue, setSocialQueue] = useState([]);
  const [trend, setTrend] = useState(null);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [jobForm, setJobForm] = useState({
    topic: 'First-time buyer guide for Lagos apartments',
    promptType: 'property_guide',
    scheduledFor: '',
    sourceLinks: ''
  });

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) || posts[0] || null,
    [posts, selectedPostId]
  );

  useEffect(() => {
    if (!selectedPost) {
      setDraft(null);
      return;
    }
    setSelectedPostId(selectedPost.id);
    setDraft({
      title: selectedPost.title || '',
      slug: selectedPost.slug || '',
      summary: selectedPost.summary || '',
      metaDescription: selectedPost.metaDescription || '',
      bodyMarkdown: selectedPost.bodyMarkdown || '',
      tags: Array.isArray(selectedPost.tags) ? selectedPost.tags.join(', ') : '',
      sourceLinks: referencesToText(selectedPost.sourceReferences),
      scheduledFor: toLocalInputValue(selectedPost.scheduledFor)
    });
  }, [selectedPost]);

  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/admin/content');
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result?.error || 'Failed to load content automation dashboard');
      }
      setPosts(Array.isArray(result.posts) ? result.posts : []);
      setJobs(Array.isArray(result.jobs) ? result.jobs : []);
      setSocialQueue(Array.isArray(result.socialQueue) ? result.socialQueue : []);
      setTrend(result.trend || null);
    } catch (error) {
      console.error('Content dashboard load failed:', error);
      toast.error(error.message || 'Failed to load content dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const runAction = useCallback(async (payload, successMessage) => {
    try {
      setSaving(true);
      const response = await authenticatedFetch('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result?.error || 'Content action failed');
      }
      toast.success(successMessage);
      await loadContent();
      return result;
    } catch (error) {
      console.error('Content action failed:', error);
      toast.error(error.message || 'Content action failed');
      return null;
    } finally {
      setSaving(false);
    }
  }, [loadContent]);

  const createJob = () => runAction({
    action: 'createJob',
    topic: jobForm.topic,
    promptType: jobForm.promptType,
    scheduledFor: fromLocalInputValue(jobForm.scheduledFor),
    sourceReferences: parseSourceReferences(jobForm.sourceLinks)
  }, 'Content job queued');

  const saveDraft = () => {
    if (!selectedPost || !draft) return null;
    return runAction({
      action: 'updatePost',
      postId: selectedPost.id,
      updates: {
        ...draft,
        tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        sourceReferences: parseSourceReferences(draft.sourceLinks)
      }
    }, 'Post saved');
  };

  const publishPost = () => {
    if (!selectedPost || !draft) return null;
    return runAction({
      action: 'publishPost',
      postId: selectedPost.id,
      updates: {
        ...draft,
        tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        sourceReferences: parseSourceReferences(draft.sourceLinks)
      }
    }, 'Post published');
  };

  const schedulePost = () => {
    if (!selectedPost || !draft) return null;
    return runAction({
      action: 'schedulePost',
      postId: selectedPost.id,
      scheduledFor: fromLocalInputValue(draft.scheduledFor) || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      updates: {
        ...draft,
        tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        sourceReferences: parseSourceReferences(draft.sourceLinks)
      }
    }, 'Post scheduled');
  };

  const queueSocial = () => {
    if (!selectedPost) return null;
    return runAction({
      action: 'queueSocial',
      postId: selectedPost.id,
      scheduledFor: selectedPost.scheduledFor || null
    }, 'Social shares queued');
  };

  const refreshTrends = () => runAction({ action: 'refreshTrends' }, 'Market trends refreshed');

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-3 text-gray-600">Loading content automation...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Content Automation</h3>
          <p className="text-gray-600">Create AI-assisted drafts, review blog posts, and schedule social sharing.</p>
        </div>
        <button
          type="button"
          onClick={loadContent}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <p className="font-semibold text-blue-950">New AI Draft Job</p>
          </div>
          <input
            value={jobForm.topic}
            onChange={(event) => setJobForm((prev) => ({ ...prev, topic: event.target.value }))}
            className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Topic"
          />
          <select
            value={jobForm.promptType}
            onChange={(event) => setJobForm((prev) => ({ ...prev, promptType: event.target.value }))}
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="property_guide">Property guide</option>
            <option value="market_insight">Market insight</option>
            <option value="agent_tip">Agent tip</option>
            <option value="buyer_tip">Buyer tip</option>
          </select>
          <input
            type="datetime-local"
            value={jobForm.scheduledFor}
            onChange={(event) => setJobForm((prev) => ({ ...prev, scheduledFor: event.target.value }))}
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <textarea
            value={jobForm.sourceLinks}
            onChange={(event) => setJobForm((prev) => ({ ...prev, sourceLinks: event.target.value }))}
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            rows={3}
            placeholder="Optional sources, one per line: Title | https://source.com | note"
          />
          <button
            type="button"
            onClick={createJob}
            disabled={saving}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            Queue Draft
          </button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <p className="font-semibold text-gray-900">Market Trends</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-blue-950">{trend?.totals?.totalActiveListings || 0}</p>
          <p className="text-sm text-gray-500">active listings analysed</p>
          <button
            type="button"
            onClick={refreshTrends}
            disabled={saving}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Trends
          </button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Send className="h-5 w-5 text-amber-600" />
            <p className="font-semibold text-gray-900">Social Queue</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-blue-950">{socialQueue.length}</p>
          <p className="text-sm text-gray-500">recent Buffer queue items</p>
          <div className="mt-4 space-y-2">
            {socialQueue.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <span className="capitalize text-gray-700">{item.platform}</span>
                <StatusPill status={item.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-5 py-4">
            <p className="font-semibold text-gray-900">Blog Posts</p>
          </div>
          <div className="max-h-[620px] divide-y divide-gray-100 overflow-y-auto">
            {posts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No content drafts yet.</div>
            ) : posts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => setSelectedPostId(post.id)}
                className={`block w-full px-5 py-4 text-left hover:bg-blue-50 ${selectedPost?.id === post.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{post.title || 'Untitled post'}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">{post.summary || post.topic}</p>
                  </div>
                  <StatusPill status={post.status} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {!draft ? (
            <div className="p-10 text-center text-gray-500">
              <FileText className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3">Select a draft to review and edit.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">Review Draft</p>
                  <p className="text-sm text-gray-500">{selectedPost?.id}</p>
                </div>
                <StatusPill status={selectedPost?.status} />
              </div>
              <input
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Title"
              />
              <input
                value={draft.slug}
                onChange={(event) => setDraft((prev) => ({ ...prev, slug: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Slug"
              />
              <textarea
                value={draft.summary}
                onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Summary"
              />
              <textarea
                value={draft.metaDescription}
                onChange={(event) => setDraft((prev) => ({ ...prev, metaDescription: event.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="SEO meta description"
              />
              <input
                value={draft.tags}
                onChange={(event) => setDraft((prev) => ({ ...prev, tags: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Tags, comma separated"
              />
              <textarea
                value={draft.sourceLinks}
                onChange={(event) => setDraft((prev) => ({ ...prev, sourceLinks: event.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Sources, one per line: Title | https://source.com | note"
              />
              <input
                type="datetime-local"
                value={draft.scheduledFor}
                onChange={(event) => setDraft((prev) => ({ ...prev, scheduledFor: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Schedule time"
              />
              <textarea
                value={draft.bodyMarkdown}
                onChange={(event) => setDraft((prev) => ({ ...prev, bodyMarkdown: event.target.value }))}
                rows={14}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:outline-none"
                placeholder="Markdown body"
              />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <button type="button" onClick={saveDraft} disabled={saving} className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60">Save</button>
                <button type="button" onClick={publishPost} disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">Publish</button>
                <button type="button" onClick={schedulePost} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"><CalendarClock className="h-4 w-4" />Schedule</button>
                <button type="button" onClick={queueSocial} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"><Send className="h-4 w-4" />Buffer</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="font-semibold text-gray-900">Recent Content Jobs</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {jobs.slice(0, 8).map((job) => (
            <div key={job.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{job.topic}</p>
                  <p className="mt-1 text-xs text-gray-500">Attempts: {job.attempts || 0}</p>
                  {job.lastError && <p className="mt-2 text-xs text-red-600">{job.lastError}</p>}
                </div>
                <StatusPill status={job.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
