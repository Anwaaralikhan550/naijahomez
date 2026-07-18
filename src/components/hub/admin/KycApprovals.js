'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Ban, ExternalLink, FileText, Loader2, ShieldAlert, UserCheck } from 'lucide-react';
import { authenticatedFetch } from '@/services/api';
import toast from 'react-hot-toast';

const KycApprovals = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [rejectionReasons, setRejectionReasons] = useState({});

  const formatDate = useCallback((value) => {
    if (!value) return 'N/A';

    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 'N/A';
      return date.toLocaleString();
    } catch (formatError) {
      return 'N/A';
    }
  }, []);

  const resolveDocUrl = useCallback((documentValue) => {
    if (!documentValue) return null;

    if (typeof documentValue === 'string') {
      return documentValue;
    }

    if (typeof documentValue === 'object') {
      return (
        documentValue.url ||
        documentValue.fileUrl ||
        documentValue.downloadURL ||
        documentValue.documentUrl ||
        documentValue.frontUrl ||
        documentValue.front ||
        documentValue.backUrl ||
        documentValue.back ||
        null
      );
    }

    return null;
  }, []);

  const loadPendingUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch('/api/admin/kyc-approvals');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to load pending KYC approvals');
      }

      setUsers(Array.isArray(result?.users) ? result.users : []);
    } catch (fetchError) {
      console.error('Error loading pending KYC users:', fetchError);
      setError(fetchError.message || 'Failed to load pending KYC approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingUsers();
  }, [loadPendingUsers]);

  const pendingCount = useMemo(() => users.length, [users]);

  const handleAction = useCallback(async (pendingUser, action) => {
    const userId = pendingUser?.uid || pendingUser?.id;
    if (!userId || !['approve', 'reject'].includes(action)) {
      toast.error('Invalid KYC action');
      return;
    }

    const rejectionReason = String(rejectionReasons[userId] || '').trim();
    if (action === 'reject' && rejectionReason.length < 5) {
      toast.error('Please enter a clear rejection reason first.');
      return;
    }

    try {
      setUpdatingUserId(userId);

      const response = await authenticatedFetch('/api/admin/kyc-approvals', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          submissionId: pendingUser.submissionId || null,
          action,
          rejectionReason
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to update KYC status');
      }

      toast.success(action === 'approve' ? 'User KYC approved' : 'User KYC rejected');
      setRejectionReasons((prev) => ({ ...prev, [userId]: '' }));
      await loadPendingUsers();
    } catch (actionError) {
      console.error('Error updating KYC status:', actionError);
      toast.error(actionError.message || 'Failed to update KYC status');
    } finally {
      setUpdatingUserId(null);
    }
  }, [loadPendingUsers, rejectionReasons]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">KYC Approvals</h3>
          <p className="text-gray-600">Review and approve pending user verification requests.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
          <BadgeCheck className="h-4 w-4" />
          {pendingCount} pending
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-3 text-gray-600">Loading pending KYC submissions...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-700">Could not load KYC approvals</p>
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={loadPendingUsers}
                className="mt-3 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <UserCheck className="mx-auto h-8 w-8 text-green-600" />
          <p className="mt-3 font-medium text-gray-900">No pending KYC approvals</p>
          <p className="text-sm text-gray-600">All verification requests have been processed.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">KYC Docs</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Submitted</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((pendingUser) => {
                  const userId = pendingUser.uid || pendingUser.id;
                  const idDocUrl = resolveDocUrl(pendingUser.idVerification);
                  const cacDocUrl = resolveDocUrl(pendingUser.cacVerification);
                  const isUpdating = updatingUserId === userId;
                  const phoneVerified = Boolean(pendingUser.phoneVerification?.verified);

                  return (
                    <tr key={userId} className="hover:bg-gray-50">
                      <td className="px-4 py-4 align-top">
                        <p className="font-medium text-gray-900">{pendingUser.displayName || 'Unnamed User'}</p>
                        <p className="text-xs text-gray-500">{userId}</p>
                        <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {pendingUser.kycStatus || 'pending'}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-gray-700">
                        <p>{pendingUser.email || 'No email'}</p>
                        <p className="text-gray-500">{pendingUser.phoneNumber || 'No phone'}</p>
                        <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          phoneVerified
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {phoneVerified ? 'Phone verified' : 'Phone not verified'}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          {idDocUrl ? (
                            <a
                              href={idDocUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              ID
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500">No ID doc</span>
                          )}

                          {cacDocUrl ? (
                            <a
                              href={cacDocUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              CAC
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500">No CAC doc</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-gray-600">
                        <p>{formatDate(pendingUser.submittedAt || pendingUser.updatedAt || pendingUser.createdAt)}</p>
                        {pendingUser.rejectionReason && (
                          <p className="mt-2 rounded-lg border border-red-100 bg-red-50 p-2 text-xs text-red-700">
                            Previous rejection: {pendingUser.rejectionReason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="min-w-[240px] space-y-2">
                          <textarea
                            value={rejectionReasons[userId] || ''}
                            onChange={(event) => setRejectionReasons((prev) => ({
                              ...prev,
                              [userId]: event.target.value
                            }))}
                            placeholder="Reason required if rejecting"
                            rows={2}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                          />
                          <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleAction(pendingUser, 'approve')}
                            disabled={isUpdating}
                            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction(pendingUser, 'reject')}
                            disabled={isUpdating}
                            className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                            Reject
                          </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default KycApprovals;
