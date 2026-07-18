'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Mail, MessageCircle, RefreshCw, Send, ShieldAlert, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { authenticatedFetch } from '@/services/api';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_user', label: 'Waiting User' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' }
];

const STATUS_STYLES = {
  open: 'bg-blue-50 text-blue-700 border-blue-100',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-100',
  waiting_user: 'bg-slate-50 text-slate-700 border-slate-100',
  escalated: 'bg-red-50 text-red-700 border-red-100',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  closed: 'bg-gray-100 text-gray-600 border-gray-200'
};

const PRIORITY_STYLES = {
  low: 'bg-gray-50 text-gray-600',
  normal: 'bg-blue-50 text-blue-700',
  high: 'bg-amber-50 text-amber-700',
  urgent: 'bg-red-50 text-red-700'
};

function formatDate(value) {
  if (!value) return 'Not set';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return 'Invalid date';
  }
}

function StatusChip({ status }) {
  const label = String(status || 'open').replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[status] || STATUS_STYLES.open}`}>
      {label}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    emerald: 'bg-emerald-50 text-emerald-600'
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`rounded-2xl p-3 ${tones[tone] || tones.blue}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value || 0}</p>
        </div>
      </div>
    </div>
  );
}

export default function SupportManagement() {
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState({});
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [reply, setReply] = useState('');
  const [replyChannel, setReplyChannel] = useState('email');
  const [escalationReason, setEscalationReason] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  const selectedTicket = useMemo(() => {
    if (!selected) return tickets[0] || null;
    return tickets.find((ticket) => ticket.id === selected.id) || selected;
  }, [selected, tickets]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/admin/support?status=${encodeURIComponent(status)}&limit=150`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load support tickets');
      }
      setTickets(result.tickets || []);
      setSummary(result.summary || {});
      if (result.tickets?.length && !selected) {
        setSelected(result.tickets[0]);
      }
    } catch (error) {
      console.error('Support load error:', error);
      toast.error(error.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const refreshSelected = async (ticketId) => {
    const response = await authenticatedFetch(`/api/admin/support/${ticketId}`);
    const result = await response.json();
    if (response.ok && result.success) {
      setSelected(result.ticket);
      setTickets((prev) => prev.map((ticket) => ticket.id === ticketId ? result.ticket : ticket));
    }
  };

  const patchTicket = async (body, successMessage) => {
    if (!selectedTicket) return;
    try {
      setUpdating(true);
      const response = await authenticatedFetch(`/api/admin/support/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update support ticket');
      }
      setSelected(result.ticket);
      setTickets((prev) => prev.map((ticket) => ticket.id === selectedTicket.id ? result.ticket : ticket));
      toast.success(successMessage);
      return result.ticket;
    } catch (error) {
      console.error('Support update error:', error);
      toast.error(error.message || 'Failed to update support ticket');
      return null;
    } finally {
      setUpdating(false);
    }
  };

  const handleReply = async () => {
    if (!reply.trim()) {
      toast.error('Please write a reply first.');
      return;
    }
    const ticket = await patchTicket({ action: 'reply', channel: replyChannel, message: reply }, 'Reply sent and logged');
    if (ticket) {
      setReply('');
      await refreshSelected(ticket.id);
    }
  };

  const handleEscalate = async () => {
    if (escalationReason.trim().length < 5) {
      toast.error('Please add an escalation reason.');
      return;
    }
    const ticket = await patchTicket({ action: 'escalate', escalationReason, assignee: 'dev_team' }, 'Ticket escalated to dev team');
    if (ticket) setEscalationReason('');
  };

  const handleResolve = async () => {
    if (resolutionNote.trim().length < 3) {
      toast.error('Please add a resolution note.');
      return;
    }
    const ticket = await patchTicket({ action: 'resolve', note: resolutionNote }, 'Ticket marked as resolved');
    if (ticket) setResolutionNote('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Customer Support</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">Support Inbox & Escalations</h2>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Manage contact form requests, WhatsApp support messages, complaints, fraud reports, and technical escalations from one place.
          </p>
        </div>
        <button
          onClick={loadTickets}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard icon={MessageCircle} label="Total Tickets" value={summary.total} tone="blue" />
        <SummaryCard icon={Clock} label="Open / Active" value={(summary.open || 0) + (summary.in_progress || 0)} tone="amber" />
        <SummaryCard icon={ShieldAlert} label="Escalated" value={summary.escalated} tone="red" />
        <SummaryCard icon={CheckCircle2} label="Resolved" value={summary.resolved} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">Inbox</h3>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="max-h-[680px] space-y-3 overflow-y-auto pr-1">
              {loading ? (
                <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">Loading support inbox...</div>
              ) : tickets.length === 0 ? (
                <div className="rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-700">No tickets found for this filter.</div>
              ) : tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelected(ticket)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${selectedTicket?.id === ticket.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-white hover:border-blue-100 hover:bg-blue-50/40'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-blue-600">{ticket.ticketNumber}</p>
                      <h4 className="mt-1 line-clamp-1 font-semibold text-gray-900">{ticket.subject}</h4>
                    </div>
                    <StatusChip status={ticket.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-gray-600">{ticket.lastMessage}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className={`rounded-full px-2 py-1 font-semibold capitalize ${PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.normal}`}>{ticket.priority}</span>
                    <span className="capitalize">{ticket.source}</span>
                    <span>{formatDate(ticket.updatedAt || ticket.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          {selectedTicket ? (
            <div className="space-y-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{selectedTicket.ticketNumber}</p>
                  <h3 className="mt-1 text-xl font-bold text-gray-900">{selectedTicket.subject}</h3>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusChip status={selectedTicket.status} />
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${PRIORITY_STYLES[selectedTicket.priority] || PRIORITY_STYLES.normal}`}>{selectedTicket.priority} priority</span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-600">{selectedTicket.channel}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-500 md:text-right">
                  <p>Created {formatDate(selectedTicket.createdAt)}</p>
                  <p>Updated {formatDate(selectedTicket.updatedAt)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <UserRound className="mb-2 h-4 w-4 text-blue-600" />
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="font-semibold text-gray-900">{selectedTicket.name || 'Unknown'}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <Mail className="mb-2 h-4 w-4 text-blue-600" />
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="break-all font-semibold text-gray-900">{selectedTicket.email || 'Not provided'}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <MessageCircle className="mb-2 h-4 w-4 text-blue-600" />
                  <p className="text-xs text-gray-500">Phone / WhatsApp</p>
                  <p className="font-semibold text-gray-900">{selectedTicket.phone || 'Not provided'}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Latest Message</p>
                <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{selectedTicket.lastMessage || selectedTicket.message}</p>
              </div>

              {selectedTicket.escalationReason && (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Escalation Reason</p>
                  <p className="mt-2 text-sm text-red-700">{selectedTicket.escalationReason}</p>
                </div>
              )}

              {selectedTicket.resolutionNote && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Resolution</p>
                  <p className="mt-2 text-sm text-emerald-700">{selectedTicket.resolutionNote}</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-100 p-4">
                  <h4 className="mb-3 font-semibold text-gray-900">Workflow Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => patchTicket({ status: 'in_progress', action: 'assign' }, 'Ticket moved to in progress')} disabled={updating} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">Start Work</button>
                    <button onClick={() => patchTicket({ status: 'waiting_user' }, 'Ticket marked as waiting user')} disabled={updating} className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60">Waiting User</button>
                    <button onClick={() => patchTicket({ action: 'close' }, 'Ticket closed')} disabled={updating} className="rounded-xl bg-gray-600 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60">Close</button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <textarea value={escalationReason} onChange={(event) => setEscalationReason(event.target.value)} rows={3} placeholder="Escalation reason for technical/dev team..." className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-100" />
                    <button onClick={handleEscalate} disabled={updating} className="inline-flex items-center rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                      <AlertTriangle className="mr-2 h-4 w-4" /> Escalate
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 p-4">
                  <h4 className="mb-3 font-semibold text-gray-900">Resolve Ticket</h4>
                  <textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} rows={4} placeholder="Resolution note..." className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                  <button onClick={handleResolve} disabled={updating} className="mt-3 inline-flex items-center rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Resolved
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-4">
                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h4 className="font-semibold text-gray-900">Reply to Customer</h4>
                  <select value={replyChannel} onChange={(event) => setReplyChannel(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} placeholder="Write a clear support reply..." className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                <button onClick={handleReply} disabled={updating} className="mt-3 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                  <Send className="mr-2 h-4 w-4" /> Send Reply
                </button>
              </div>

              {selectedTicket.messages?.length > 0 && (
                <div className="rounded-2xl border border-gray-100 p-4">
                  <h4 className="mb-3 font-semibold text-gray-900">Conversation History</h4>
                  <div className="space-y-3">
                    {selectedTicket.messages.map((message) => (
                      <div key={message.id} className={`rounded-2xl p-3 ${message.direction === 'outbound' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                        <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                          <span className="capitalize">{message.direction} via {message.channel}</span>
                          <span>{formatDate(message.createdAt)}</span>
                        </div>
                        <p className="whitespace-pre-line text-sm text-gray-700">{message.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center text-gray-500 shadow-sm">Select a ticket to view details.</div>
          )}
        </div>
      </div>
    </div>
  );
}
