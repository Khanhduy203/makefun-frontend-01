// Small helpers for showing API values. Everything that reaches the page is escaped first.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('1000.00', 0.5, null) as '$1,000' or '$0.50'; null stays '—'. */
export function money(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** A count with thousands separators. */
export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

/** A micro-unit rate (973639 = 0.973639) as '97.4%'. */
export function rate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${(n / 10000).toFixed(1)}%`;
}

/** An ISO date as a short UTC date + time. */
export function date(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** The time until a deadline: '2d 4h left', '35m left', '42s left', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return `${seconds}s left`;
}

/** How long ago an ISO time was: '3h ago', '2d ago', 'just now'. */
export function relTime(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date(iso);
}

/** Whether a bounty still takes entries: its deadline, not its status, decides. */
export function stillOpen(bounty) {
  return new Date(bounty.deadline).getTime() > Date.now();
}

/** Shorten a long address or id: first 6 + '…' + last 4. */
export function shorten(value) {
  const s = String(value ?? '');
  return s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

const INLINE = [
  [/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'],
  [/\*([^*]+)\*/g, '<em>$1</em>'],
  [/`([^`]+)`/g, '<code>$1</code>'],
];

/** Inline markdown (bold, italic, code) on already-escaped text, plus autolinked make.fun URLs. */
function inline(text) {
  let out = text;
  for (const [re, rep] of INLINE) out = out.replace(re, rep);
  return out.replace(
    /(https:\/\/make\.fun[^\s<)]+)/g,
    '<a href="$1">$1</a>',
  );
}

/**
 * A small, safe markdown subset for bounty descriptions and rules: headings,
 * paragraphs, bullet/numbered lists, code blocks and inline bold/italic/code.
 * The input is escaped before any markup is applied, so no HTML survives.
 */
export function md(source) {
  const lines = esc(source ?? '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i += 1; continue; }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length + 1;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const block = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) { block.push(lines[i]); i += 1; }
      i += 1;
      out.push(`<pre><code>${block.join('\n')}</code></pre>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|```|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}
