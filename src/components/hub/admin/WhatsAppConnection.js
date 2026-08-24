'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { authenticatedFetch } from '@/services/api';

const QR_LIFETIME_SECONDS = 60;
const STATUS_POLL_MS = 5000;

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

function StatusBanner({ status }) {
  if (!status) return null;

  if (status.connected) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
        <div>
          <p className="font-semibold text-emerald-900">WhatsApp is connected</p>
          <p className="mt-1 text-sm text-emerald-800">
            Outreach and reminders are sending from
            {status.number ? ` +${status.number}` : ' the linked number'}
            {status.profileName ? ` (${status.profileName})` : ''}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
      <div>
        <p className="font-semibold text-red-900">
          WhatsApp is not connected{status.connectionStatus ? ` (${status.connectionStatus})` : ''}
        </p>
        <p className="mt-1 text-sm text-red-800">
          Every outreach message and reminder will fail until the phone is linked again.
          Queued messages are kept and will send once the link is restored.
        </p>
        {status.disconnectionAt ? (
          <p className="mt-2 text-xs text-red-700">
            Disconnected {formatDateTime(status.disconnectionAt)}
            {status.disconnectReason ? ` — reason: ${status.disconnectReason}` : ''}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function WhatsAppConnection() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pairing, setPairing] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const pollRef = useRef(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/admin/whatsapp');
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to read status');
      setStatus(data);
      return data;
    } catch (error) {
      setStatus(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus().catch(() => {});
  }, [loadStatus]);

  // While a QR is on screen the phone may scan at any moment, so poll until the
  // gateway reports the link is open, then drop the QR.
  useEffect(() => {
    if (!pairing) return undefined;

    pollRef.current = setInterval(async () => {
      try {
        const data = await loadStatus();
        if (data?.connected) {
          setPairing(null);
          toast.success('WhatsApp connected');
        }
      } catch {}
    }, STATUS_POLL_MS);

    return () => clearInterval(pollRef.current);
  }, [pairing, loadStatus]);

  useEffect(() => {
    if (!pairing) return undefined;
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [pairing, secondsLeft]);

  const generateQr = async () => {
    setGenerating(true);
    try {
      const response = await authenticatedFetch('/api/admin/whatsapp', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to generate QR');
      setPairing(data);
      setSecondsLeft(data.expiresInSeconds || QR_LIFETIME_SECONDS);
    } catch (error) {
      toast.error(error.message || 'Failed to generate QR');
    } finally {
      setGenerating(false);
    }
  };

  const expired = pairing && secondsLeft <= 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-blue-950">WhatsApp Connection</h2>
          <p className="text-sm text-gray-500">
            The linked phone that sends agent outreach and reminders.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadStatus().catch(() => toast.error('Could not reach the gateway'))}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {status ? (
        <StatusBanner status={status} />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Could not reach the WhatsApp gateway. It may be restarting — try Refresh in a moment.
        </div>
      )}

      {status && !status.connected ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-blue-950">Link the phone again</p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-700">
                <li>Pick up the phone with the outreach WhatsApp number.</li>
                <li>Open WhatsApp, then <strong>Settings &rarr; Linked Devices</strong>.</li>
                <li>Tap <strong>Link a Device</strong>.</li>
                <li>Press the button below and scan the code straight away.</li>
              </ol>
              <p className="mt-3 text-sm text-gray-500">
                The code is only valid for about a minute, so generate it once the phone is
                already on the scanning screen.
              </p>

              {!pairing ? (
                <button
                  type="button"
                  onClick={generateQr}
                  disabled={generating}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                  {generating ? 'Generating...' : 'Show QR code'}
                </button>
              ) : (
                <div className="mt-5">
                  <div className={`inline-block rounded-2xl border p-4 ${expired ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-white'}`}>
                    {pairing.qrBase64 ? (
                      <img
                        src={pairing.qrBase64}
                        alt="WhatsApp pairing QR code"
                        width={264}
                        height={264}
                        className={`h-66 w-66 ${expired ? 'opacity-25' : ''}`}
                        style={{ width: 264, height: 264 }}
                      />
                    ) : null}
                    {pairing.pairingCode ? (
                      <p className="mt-3 text-center font-mono text-lg tracking-widest text-blue-950">
                        {pairing.pairingCode}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    {expired ? (
                      <span className="text-sm font-medium text-red-600">This code has expired.</span>
                    ) : (
                      <span className="text-sm text-gray-600">
                        Expires in <strong>{secondsLeft}s</strong> — waiting for the scan...
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={generateQr}
                      disabled={generating}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      New code
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
