// Outbound WhatsApp messages must only leave during waking hours in the
// recipient's timezone. The scrape pipeline runs at ~03:00 Lagos, and before
// this gate existed the onboarding worker ran straight after it -- 79% of all
// outreach landed between 03:00 and 05:00 Lagos, which reads as spam and risks
// the number being reported. Scraping and sending are now decoupled: the queue
// fills overnight, this gate holds it until the send window opens.

const DEFAULT_TIMEZONE = 'Africa/Lagos';
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 11;

function isExplicitFalse(value) {
  return ['0', 'false', 'no', 'off'].includes(String(value ?? '').trim().toLowerCase());
}

function readHour(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(23, Math.max(0, Math.trunc(parsed)));
}

function getSendWindow() {
  return {
    enabled: !isExplicitFalse(process.env.OUTREACH_SEND_WINDOW_ENABLED),
    timeZone: process.env.OUTREACH_SEND_TIMEZONE || DEFAULT_TIMEZONE,
    startHour: readHour(process.env.OUTREACH_SEND_WINDOW_START_HOUR, DEFAULT_START_HOUR),
    endHour: readHour(process.env.OUTREACH_SEND_WINDOW_END_HOUR, DEFAULT_END_HOUR)
  };
}

// Intl is the only dependency-free way to read the wall-clock hour in another
// timezone; it handles DST for us even though Lagos does not observe it.
function getZonedParts(timeZone, date) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type === 'hour' || part.type === 'minute') acc[part.type] = Number(part.value);
    return acc;
  }, {});

  return {
    hour: Number.isFinite(parts.hour) ? parts.hour % 24 : 0,
    minute: Number.isFinite(parts.minute) ? parts.minute : 0
  };
}

function describeSendWindow(window = getSendWindow()) {
  const pad = (hour) => String(hour).padStart(2, '0');
  return `${pad(window.startHour)}:00-${pad(window.endHour)}:00 ${window.timeZone}`;
}

function evaluateSendWindow(date = new Date(), window = getSendWindow()) {
  if (!window.enabled) {
    return { open: true, reason: 'window_disabled', window };
  }

  // A start >= end would silently close the window forever; treat it as
  // misconfiguration and stay open rather than block all outreach.
  if (window.startHour >= window.endHour) {
    return { open: true, reason: 'window_misconfigured', window };
  }

  const { hour, minute } = getZonedParts(window.timeZone, date);
  if (hour >= window.startHour && hour < window.endHour) {
    return { open: true, reason: 'within_window', window, localHour: hour };
  }

  const hoursUntilStart = hour < window.startHour
    ? window.startHour - hour
    : 24 - hour + window.startHour;
  const waitMs = Math.max(60 * 1000, (hoursUntilStart * 60 - minute) * 60 * 1000);

  return { open: false, reason: 'outside_window', window, localHour: hour, waitMs };
}

function isWithinSendWindow(date = new Date()) {
  return evaluateSendWindow(date).open;
}

module.exports = {
  describeSendWindow,
  evaluateSendWindow,
  getSendWindow,
  isWithinSendWindow
};
