// The four surfaces, each a function from API data to HTML. Every value that
// comes from the API is escaped by format.js before it reaches the page.

import { date, esc, md, money, num, rate, relTime, shorten, stillOpen, timeLeft } from './format.js';

const PAGE_SIZE = 50;

/** The reward as it stands now: the live pot, else the posted reward. */
const potOf = (b) => money(b.potUsd ?? b.rewardAmount);

/** A bounty still taking entries, by its deadline. */
const isOpen = (b) => stillOpen(b);

/** Closing within 24 hours and still open. */
const closingSoon = (b) => {
  const ms = new Date(b.deadline).getTime() - Date.now();
  return ms > 0 && ms < 86400000;
};

/** Status badge: open, closing soon, or ended (by deadline, not by status). */
function statusBadge(b) {
  if (!isOpen(b)) return '<span class="badge ended">Ended</span>';
  if (closingSoon(b)) return '<span class="badge soon">Closing soon</span>';
  return '<span class="badge open">Open</span>';
}

function feeLine(b) {
  return b.entryFeeUsd ? `<span class="fee">${money(b.entryFeeUsd)} entry fee</span>` : '';
}

// ---------------------------------------------------------------- board

/** The board's summary numbers, over the bounties still taking entries. */
export function boardStats(items) {
  const open = items.filter(isOpen);
  const totalPot = open.reduce((sum, b) => sum + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const totalEntries = open.reduce((sum, b) => sum + Number(b.submissionCount ?? 0), 0);
  const soon = open.filter(closingSoon).length;
  return { open: open.length, totalPot, totalEntries, soon };
}

/** One bounty card: title, pot, fee, time left, entries. */
function bountyCard(b) {
  return `
    <li class="card">
      <div class="card-body">
        <div class="kicker"><span>${esc(b.category ?? 'Bounty')}</span>${statusBadge(b)}</div>
        <h3><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h3>
        <p class="summary">${esc(b.summary ?? b.description ?? '')}</p>
      </div>
      <div class="card-foot">
        <span class="pot">${potOf(b)}</span>
        ${feeLine(b)}
        <span>${timeLeft(b.deadline)}</span>
        <span>${num(b.submissionCount)} ${Number(b.submissionCount) === 1 ? 'entry' : 'entries'}</span>
      </div>
    </li>`;
}

export const SORTS = {
  pot: (a, b) => Number(b.potUsd ?? b.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0),
  deadline: (a, b) => new Date(a.deadline) - new Date(b.deadline),
  entries: (a, b) => Number(b.submissionCount ?? 0) - Number(a.submissionCount ?? 0),
  newest: (a, b) => new Date(b.publishedAt ?? b.opensAt ?? 0) - new Date(a.publishedAt ?? a.opensAt ?? 0),
};

/** Filter + sort the board's items for the current controls. Pure: no fetching. */
export function filterBoard(items, { query, filter, sort }) {
  const q = query.trim().toLowerCase();
  let list = items.filter((b) => {
    if (filter === 'open' && !isOpen(b)) return false;
    if (filter === 'soon' && !closingSoon(b)) return false;
    if (q && !`${b.title} ${b.summary ?? ''} ${b.category ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  list = [...list].sort(SORTS[sort] ?? SORTS.pot);
  return list;
}

/** The board: stats, controls, and the card list (the list alone re-renders on filter). */
export function boardPage(data, state) {
  const stats = boardStats(data.items);
  const list = filterBoard(data.items, state);
  return `
    <h1>Live bounties</h1>
    <p class="lede">Every bounty on make.fun, with its live pot, entry fee and time left. Click one for its rules, rewards and leaderboard.</p>
    <section class="stats" aria-label="Board totals">
      <div class="stat"><span class="num">${num(stats.open)}</span><span class="lbl">open bounties</span></div>
      <div class="stat"><span class="num">${money(stats.totalPot)}</span><span class="lbl">total live pot</span></div>
      <div class="stat"><span class="num">${num(stats.totalEntries)}</span><span class="lbl">entries so far</span></div>
      <div class="stat"><span class="num">${num(stats.soon)}</span><span class="lbl">closing within 24h</span></div>
    </section>
    <div class="controls">
      <input id="board-search" type="search" placeholder="Search bounties…" value="${esc(state.query)}" aria-label="Search bounties">
      <div class="group" role="group" aria-label="Filter">
        <button class="chip" data-filter="open" aria-pressed="${state.filter === 'open'}">Open now</button>
        <button class="chip" data-filter="soon" aria-pressed="${state.filter === 'soon'}">Closing soon</button>
        <button class="chip" data-filter="all" aria-pressed="${state.filter === 'all'}">All listed</button>
      </div>
      <label class="visually-hidden" for="board-sort">Sort by</label>
      <select id="board-sort">
        <option value="pot" ${state.sort === 'pot' ? 'selected' : ''}>Largest pot</option>
        <option value="deadline" ${state.sort === 'deadline' ? 'selected' : ''}>Closing soonest</option>
        <option value="entries" ${state.sort === 'entries' ? 'selected' : ''}>Most entries</option>
        <option value="newest" ${state.sort === 'newest' ? 'selected' : ''}>Newest</option>
      </select>
      <span class="result-count" id="board-count">${num(list.length)} ${list.length === 1 ? 'bounty' : 'bounties'}</span>
    </div>
    <ul class="cards" id="board-list">${list.map(bountyCard).join('') || '<li class="card"><div class="card-body"><p>No bounties match. Try another search or filter.</p></div></li>'}</ul>`;
}

/** Re-render only the board's list and count (controls and stats stay put). */
export function boardListHtml(items, state) {
  const list = filterBoard(items, state);
  return {
    list: list.map(bountyCard).join('') || '<li class="card"><div class="card-body"><p>No bounties match. Try another search or filter.</p></div></li>',
    count: `${num(list.length)} ${list.length === 1 ? 'bounty' : 'bounties'}`,
  };
}

// ---------------------------------------------------------------- bounty

/** The rewards table, from the live per-place amounts when the API gives them. */
function rewardsTable(b) {
  const rows = Array.isArray(b.rewardsNow) && b.rewardsNow.length > 0
    ? b.rewardsNow
    : Object.entries(b.rewards ?? {}).map(([place, amount]) => ({ place: Number(place), baseUsd: amount, feeShareUsd: 0, amountUsd: amount }));
  if (rows.length === 0) return '<p>No rewards published for this bounty yet.</p>';
  const body = rows
    .map((r) => `
      <tr class="${Number(r.place) <= 3 ? 'top' : ''}">
        <td>${r.place === 1 ? '1st' : r.place === 2 ? '2nd' : r.place === 3 ? '3rd' : `${r.place}th`}</td>
        <td class="num">${money(r.baseUsd)}</td>
        <td class="num">${money(r.feeShareUsd)}</td>
        <td class="num"><strong>${money(r.amountUsd)}</strong></td>
      </tr>`)
    .join('');
  return `
    <table class="rewards">
      <thead><tr><th>Place</th><th class="num">Base reward</th><th class="num">Fee share</th><th class="num">Total now</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="lede">Totals are live: entry fees paid into the pot are shared over the paid places.</p>`;
}

/** One bounty's page: summary, facts, live rewards, description and rules. */
export function bountyPage(b) {
  const skills = Array.isArray(b.skills) && b.skills.length > 0
    ? `<p class="meta">Skills: ${b.skills.map((s) => esc(s)).join(' · ')}</p>` : '';
  return `
    <p class="breadcrumb"><a href="#/">&larr; All bounties</a></p>
    <div class="bounty-head">
      <h1>${esc(b.title)}</h1>
      <p class="meta">${esc(b.category ?? 'Bounty')}${b.sponsor?.name ? ` · sponsored by ${esc(b.sponsor.name)}` : ''} · ${statusBadge(b)}</p>
      ${skills}
    </div>
    <p class="lede">${esc(b.summary ?? '')}</p>
    <section class="facts" aria-label="Key facts">
      <div class="fact"><span class="k">Live pot</span><span class="v">${potOf(b)}</span></div>
      <div class="fact"><span class="k">Entry fee</span><span class="v">${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</span></div>
      <div class="fact"><span class="k">Time left</span><span class="v">${timeLeft(b.deadline)}</span></div>
      <div class="fact"><span class="k">Entries</span><span class="v">${num(b.submissionCount)}</span></div>
    </section>
    <div class="actions">
      <a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">View leaderboard</a>
      <a class="btn ghost" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}">Open on make.fun &rarr;</a>
    </div>
    <h2>Rewards</h2>
    ${rewardsTable(b)}
    <h2>Dates</h2>
    <p>Opened ${date(b.opensAt)} · Entries close ${date(b.deadline)}${b.acceptingSubmissions === false ? ' · <strong>not accepting entries</strong>' : ''}</p>
    ${b.prizeGate ? `<h2>Prize gate</h2><p>${esc(b.prizeGate)}</p>` : ''}
    <h2>About this bounty</h2>
    <div class="prose">${md(b.description ?? b.summary ?? '')}</div>
    ${b.rules ? `<details class="rules"><summary>Full rules</summary><div class="prose" style="border:0;padding:16px 0 0">${md(b.rules)}</div></details>` : ''}`;
}

// ---------------------------------------------------------------- leaderboard

/** One leaderboard row's score: the rank key's value, as a rate for judge boards. */
function scoreOf(entry, rankKey) {
  const raw = entry.values?.[rankKey];
  if (raw === null || raw === undefined) return '—';
  if (rankKey === 'judge') return rate(raw);
  const shown = entry.display?.[rankKey];
  if (shown !== null && shown !== undefined && shown !== '') return esc(shown);
  return num(raw);
}

/** Win/draw/loss summary for a judge-scored entry. */
function recordOf(entry) {
  const j = entry.judge;
  if (!j || j.matches === null || j.matches === undefined) return '—';
  return `${num(j.wins)}W / ${num(j.draws)}D / ${num(j.losses)}L · ${num(j.matches)} games${j.provisional ? ' · provisional' : ''}`;
}

/** A page of leaderboard rows (50 at a time; the rest stays out of the DOM). */
export function leaderboardRows(entries, page) {
  const start = (page - 1) * PAGE_SIZE;
  return entries.slice(start, start + PAGE_SIZE);
}

/** A bounty's leaderboard: ranked table with search and paging. */
export function leaderboardPage(bounty, lb, { query, page }) {
  const rankKey = lb.rank_key ?? bounty.leaderboard?.rankKey ?? 'judge';
  const q = query.trim().toLowerCase();
  const entries = q
    ? lb.entries.filter((e) => `${e.handle} ${e.title ?? ''}`.toLowerCase().includes(q))
    : lb.entries;
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pages);
  const rows = leaderboardRows(entries, safePage)
    .map((e) => `
      <tr>
        <td class="num rank-medal">${e.rank ?? '—'}</td>
        <td><a href="#/u/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a>${e.house ? ' <span class="badge house">house</span>' : ''}</td>
        <td class="title-cell">${esc(e.title ?? '')}</td>
        <td class="num"><strong>${scoreOf(e, rankKey)}</strong></td>
        <td>${recordOf(e)}</td>
        <td class="num">${e.prize_rank ? `#${e.prize_rank}` : '—'}</td>
      </tr>`)
    .join('');
  return `
    <p class="breadcrumb"><a href="#/">&larr; All bounties</a> · <a href="#/bounty/${encodeURIComponent(bounty.slug)}">${esc(bounty.title)}</a></p>
    <h1>Leaderboard: ${esc(bounty.title)}</h1>
    <p class="lede">${num(lb.entries.length)} ranked entries · ranked by ${esc(rankKey)}${lb.phase?.title ? ` · ${esc(lb.phase.title)} phase` : ''}${lb.view ? ` · ${esc(lb.view)} view` : ''}</p>
    <div class="controls">
      <input id="lb-search" type="search" placeholder="Search handle or entry…" value="${esc(query)}" aria-label="Search the leaderboard">
      <span class="result-count">${num(entries.length)} matching</span>
    </div>
    <div class="tablewrap">
      <table class="data">
        <thead><tr><th class="num">Rank</th><th>Handle</th><th>Entry</th><th class="num">Score</th><th>Record</th><th class="num">Prize rank</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6">No entries match.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="pager">
      <button class="btn ghost" id="lb-prev" ${safePage <= 1 ? 'disabled' : ''}>&larr; Prev</button>
      <span>Page ${safePage} of ${num(pages)}</span>
      <button class="btn ghost" id="lb-next" ${safePage >= pages ? 'disabled' : ''}>Next &rarr;</button>
    </div>`;
}

// ---------------------------------------------------------------- profile

/** An account's public profile: identity, record and entries. */
export function profilePage(p) {
  const name = p.display_name || p.handle;
  const initial = String(name).charAt(0).toUpperCase();
  const avatarUrl = p.image || p.avatar;
  const avatar = avatarUrl
    ? `<img class="avatar" crossorigin="anonymous" src="${esc(avatarUrl)}" alt="">`
    : `<span class="avatar" aria-hidden="true">${esc(initial)}</span>`;
  const links = [];
  if (p.github_login) links.push(`<a href="https://github.com/${encodeURIComponent(p.github_login)}">GitHub: ${esc(p.github_login)}</a>`);
  if (p.x) links.push(`<a href="https://x.com/${encodeURIComponent(p.x)}">X: ${esc(p.x)}</a>`);
  if (p.discord) links.push(`<span>Discord: ${esc(p.discord)}</span>`);
  if (p.wallet?.explorer_url) links.push(`<a class="wallet-addr" href="${esc(p.wallet.explorer_url)}">${shorten(p.wallet.address)}</a>`);
  const r = p.record ?? {};
  const solutions = Array.isArray(p.solutions) ? p.solutions : [];
  const rows = solutions
    .map((s) => `
      <tr>
        <td class="title-cell"><a href="#/bounty/${encodeURIComponent(s.competition.slug)}">${esc(s.competition.title)}</a><br><span style="color:var(--faint)">${esc(s.title)}</span></td>
        <td class="num">${s.placement ? `#${num(s.placement)}` : '—'}</td>
        <td class="num">${s.prize_usd ? money(s.prize_usd) : '—'}</td>
        <td class="num">${s.score ? esc(s.score.display ?? s.score.value) : '—'}</td>
        <td>${relTime(s.entered_at)}</td>
      </tr>`)
    .join('');
  return `
    <p class="breadcrumb"><a href="#/">&larr; All bounties</a></p>
    <div class="profile-head">
      ${avatar}
      <div>
        <h1>${esc(name)}</h1>
        <div class="handle">@${esc(p.handle)} · joined ${date(p.joined_at)}</div>
        ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
        ${links.length > 0 ? `<div class="profile-links">${links.join('')}</div>` : ''}
      </div>
    </div>
    <section class="stats" style="margin-top:20px" aria-label="Record">
      <div class="stat"><span class="num">${num(r.competitions_entered)}</span><span class="lbl">bounties entered</span></div>
      <div class="stat"><span class="num">${num(r.competitions_placed)}</span><span class="lbl">placed</span></div>
      <div class="stat"><span class="num">${num(r.competitions_won)}</span><span class="lbl">won</span></div>
      <div class="stat"><span class="num">${r.best_placement ? `#${num(r.best_placement)}` : '—'}</span><span class="lbl">best placement</span></div>
      <div class="stat"><span class="num">${money(r.prize_usd)}</span><span class="lbl">prizes won</span></div>
    </section>
    <h2>Entries (${num(solutions.length)})</h2>
    ${solutions.length === 0
      ? '<p>No entries yet.</p>'
      : `<div class="tablewrap"><table class="data">
        <thead><tr><th>Bounty / entry</th><th class="num">Place</th><th class="num">Prize</th><th class="num">Score</th><th>Entered</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`}`;
}

// ---------------------------------------------------------------- shared

/** A full-page error with a retry that re-runs the current route. */
export function errorPage(message) {
  return `
    <div class="errorbox">
      <p><strong>Something went wrong.</strong></p>
      <p>${esc(message)}</p>
      <p><button class="btn" id="retry-btn">Try again</button> <a class="btn ghost" href="#/">Back to bounties</a></p>
    </div>`;
}

export function loadingPage() {
  return '<div class="loading"><p>Loading live data from make.fun…</p></div>';
}
