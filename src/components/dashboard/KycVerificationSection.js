'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  UploadCloud,
  Phone,
  FileBadge,
  Building2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { authenticatedFetch } from '@/services/api';
import { uploadFile } from '@/utils/s3GenericUpload';

const STATUS_STYLES = {
  unverified: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-blue-50 text-blue-700 border-blue-200',
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200'
};

const formatStatus = (status) => {
  const value = String(status || 'unverified').toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const mapUploadResultToDocument = (result) => ({
  url: result.url,
  fileName: result.metadata.name,
  contentType: result.metadata.type,
  size: result.metadata.size,
  storagePath: result.metadata.fullPath
});

export default function KycVerificationSection() {
  const { user } = useAuth();
  const [kycData, setKycData] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [uploading, setUploading] = useState({ id: false, cac: false });
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const kycStatus = String(kycData?.kycStatus || user?.kycStatus || 'unverified').toLowerCase();
  const statusClass = STATUS_STYLES[kycStatus] || STATUS_STYLES.unverified;
  const phoneVerified = Boolean(kycData?.phoneVerification?.verified);

  const loadKycStatus = useCallback(async () => {
    try {
      setLoadingStatus(true);
      const response = await authenticatedFetch('/api/kyc/status');
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to load verification status');
      }
      setKycData(result);
      if (result.phoneNumber) setPhone(result.phoneNumber);
    } catch (error) {
      toast.error(error.message || 'Unable to load KYC status.');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadKycStatus();
  }, [loadKycStatus]);

  const headerText = useMemo(() => {
    if (kycStatus === 'verified') return 'Your account is verified.';
    if (kycStatus === 'pending') return 'Your documents were uploaded and are pending review.';
    if (kycStatus === 'rejected') return 'Your verification was rejected. Review the reason and resubmit.';
    return 'Complete KYC to build trust and unlock full selling features.';
  }, [kycStatus]);

  const submitDocumentMetadata = async (docType, document) => {
    const body = docType === 'id'
      ? { idVerification: document }
      : { cacVerification: document };

    const response = await authenticatedFetch('/api/kyc/submit', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.error || 'Failed to submit KYC document');
    }
    setKycData((prev) => ({
      ...prev,
      ...result,
      kycStatus: result.kycStatus || 'pending',
      [docType === 'id' ? 'idVerification' : 'cacVerification']: document,
      rejectionReason: null
    }));
    return result;
  };

  const handleDocumentUpload = async (event, docType) => {
    const file = event?.target?.files?.[0];
    if (event?.target) event.target.value = '';
    if (!file) return;

    const key = docType === 'id' ? 'id' : 'cac';
    setUploading((prev) => ({ ...prev, [key]: true }));

    try {
      const folderName = docType === 'id' ? 'kyc/id' : 'kyc/cac';
      const result = await uploadFile(file, `${folderName}/${user.uid}`);
      await submitDocumentMetadata(docType, mapUploadResultToDocument(result));
      toast.success(`${docType === 'id' ? 'ID' : 'CAC'} document submitted for review.`);
      await loadKycStatus();
    } catch (error) {
      toast.error(error?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      toast.error('Enter a valid WhatsApp phone number first.');
      return;
    }

    try {
      setSendingOtp(true);
      const response = await authenticatedFetch('/api/kyc/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to send WhatsApp OTP');
      }
      toast.success(`OTP sent to WhatsApp ${result.phone || ''}`);
    } catch (error) {
      toast.error(error.message || 'Unable to send WhatsApp OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      toast.error('Enter the 6-digit OTP.');
      return;
    }

    try {
      setVerifyingOtp(true);
      const response = await authenticatedFetch('/api/kyc/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code: otp })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to verify OTP');
      }
      setOtp('');
      toast.success('Phone verified successfully.');
      await loadKycStatus();
    } catch (error) {
      toast.error(error.message || 'Unable to verify OTP.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const DocumentStatus = ({ document }) => {
    if (!document) {
      return <p className="mt-3 text-xs text-gray-500">No document uploaded yet.</p>;
    }
    return (
      <a
        href={document.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex text-xs font-medium text-blue-600 hover:text-blue-700"
      >
        View uploaded document
      </a>
    );
  };

  if (loadingStatus) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
          <p className="mt-2 text-gray-600">Loading verification status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-700">{headerText}</p>
              <span className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
                Status: {formatStatus(kycStatus)}
              </span>
              {kycStatus === 'rejected' && kycData?.rejectionReason && (
                <p className="mt-3 inline-flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {kycData.rejectionReason}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={loadKycStatus}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FileBadge className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">ID Verification</h3>
          </div>
          <p className="mb-4 text-sm text-gray-600">Upload a government-issued ID to verify your identity.</p>
          <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
            {uploading.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading.id ? 'Uploading...' : 'Upload ID Document'}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={(event) => handleDocumentUpload(event, 'id')}
              disabled={uploading.id}
            />
          </label>
          <DocumentStatus document={kycData?.idVerification} />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-gray-900">CAC Verification</h3>
          </div>
          <p className="mb-4 text-sm text-gray-600">Upload your CAC registration proof for business verification.</p>
          <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
            {uploading.cac ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading.cac ? 'Uploading...' : 'Upload CAC Document'}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={(event) => handleDocumentUpload(event, 'cac')}
              disabled={uploading.cac}
            />
          </label>
          <DocumentStatus document={kycData?.cacVerification} />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Phone className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold text-gray-900">WhatsApp Phone Verification</h3>
          </div>
          <p className="mb-4 text-sm text-gray-600">Confirm your WhatsApp number using a one-time passcode.</p>
          <div className="space-y-3">
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+234 800 000 0000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={sendingOtp}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendingOtp && <Loader2 className="h-4 w-4 animate-spin" />}
              Send WhatsApp OTP
            </button>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                placeholder="Enter OTP"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={verifyingOtp}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verifyingOtp && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify
              </button>
            </div>
            {phoneVerified && (
              <p className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Phone verified via WhatsApp
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
