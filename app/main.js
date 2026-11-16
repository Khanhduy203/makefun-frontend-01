// A make.fun frontend: the board, a bounty's page, its leaderboard and an
// account's public profile, on hash routes. One request a view at most, the
// API's answers cached and revalidated (see api.js); filtering, sorting and
// paging run on the data already fetched, with no new request.
//
//   #/                              the board of live bounties
//   #/bounty/<slug>                 one bounty: rules, live rewards, dates
//   #/bounty/<slug>/leaderboard     that bounty's ranked entries
//   #/u/<handle>                    an account's public profile
//
// window.__shotReady is false while a route loads and true once its data is
// on screen, so a screenshot script knows when to capture.

import { getBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import { boardListHtml, boardPage, bountyPage, errorPage, leaderboardPage, loadingPage, profilePage } from './views.js';

const app = document.getElementById('app');

/** Board controls, kept across re-renders of the list. */
const boardState = { query: '', filter: 'open', sort: 'pot' };

/** Leaderboard controls, reset on each new bounty. */
let lbState = { query: '', page: 1 };
let lbData = null;

/** Board data, so filtering never refetches. */
let boardData = null;

/** Increments on every route change; a late fetch renders only when it matches. */
let routeToken = 0;

function setReady(ready) {
  window.__shotReady = ready;
}

function fail(error, token) {
  if (token !== routeToken) return;
  document.title = 'Error | make.fun bounties';
  app.innerHTML = errorPage(error.status === 404 ? 'That page does not exist on make.fun.' : 'make.fun could not be reached. Check your connection and try again.');
  setReady(true);
}

async function renderBoard(token) {
  document.title = 'make.fun bounties';
  try {
    boardData = await getBounties();
  } catch (error) {
    fail(error, token);
    return;
  }
  if (token !== routeToken) return;
  app.innerHTML = boardPage(boardData, boardState);
  setReady(true);
}

async function renderBounty(slug, token) {
  try {
    const bounty = await getBounty(slug);
    if (token !== routeToken) return;
    document.title = `${bounty.title} | make.fun bounties`;
    app.innerHTML = bountyPage(bounty);
    setReady(true);
  } catch (error) {
    fail(error, token);
  }
}

async function renderLeaderboard(slug, token) {
  lbState = { query: '', page: 1 };
  try {
    const [bounty, lb] = await Promise.all([getBounty(slug), getLeaderboard(slug)]);
    if (token !== routeToken) return;
    lbData = { bounty, lb };
    document.title = `Leaderboard: ${bounty.title} | make.fun bounties`;
    app.innerHTML = leaderboardPage(bounty, lb, lbState);
    setReady(true);
  } catch (error) {
    fail(error, token);
  }
}

async function renderProfile(handle, token) {
  try {
    const profile = await getProfile(handle);
    if (token !== routeToken) return;
    document.title = `@${profile.handle} | make.fun bounties`;
    app.innerHTML = profilePage(profile);
    setReady(true);
  } catch (error) {
    fail(error, token);
  }
}

function render() {
  setReady(false);
  const token = ++routeToken;
  app.innerHTML = loadingPage();
  const hash = location.hash || '#/';
  const leaderboard = hash.match(/^#\/bounty\/([^/]+)\/leaderboard$/);
  const bounty = hash.match(/^#\/bounty\/([^/]+)$/);
  const profile = hash.match(/^#\/u\/([^/]+)$/);
  if (leaderboard) {
    renderLeaderboard(decodeURIComponent(leaderboard[1]), token);
  } else if (bounty) {
    renderBounty(decodeURIComponent(bounty[1]), token);
  } else if (profile) {
    renderProfile(decodeURIComponent(profile[1]), token);
  } else {
    renderBoard(token);
  }
  window.scrollTo(0, 0);
}

/** Re-render only the board's list and count after a control change. */
function refreshBoardList() {
  if (!boardData) return;
  const { list, count } = boardListHtml(boardData.items, boardState);
  const listEl = document.getElementById('board-list');
  const countEl = document.getElementById('board-count');
  if (listEl) listEl.innerHTML = list;
  if (countEl) countEl.textContent = count;
  document.querySelectorAll('.chip[data-filter]').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.filter === boardState.filter));
  });
}

/** Re-render the leaderboard's table and pager after a control change. */
function refreshLeaderboard() {
  if (!lbData) return;
  app.innerHTML = leaderboardPage(lbData.bounty, lbData.lb, lbState);
  const search = document.getElementById('lb-search');
  if (search) {
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);
  }
}

let searchTimer = 0;
function debounce(fn, ms) {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(fn, ms);
}

// Board and leaderboard controls, by event delegation on the app root.
app.addEventListener('input', (event) => {
  const target = event.target;
  if (target.id === 'board-search') {
    debounce(() => { boardState.query = target.value; refreshBoardList(); }, 150);
  } else if (target.id === 'lb-search') {
    debounce(() => { lbState.query = target.value; lbState.page = 1; refreshLeaderboard(); }, 150);
  }
});

app.addEventListener('change', (event) => {
  if (event.target.id === 'board-sort') {
    boardState.sort = event.target.value;
    refreshBoardList();
  }
});

app.addEventListener('click', (event) => {
  const target = event.target;
  const chip = target.closest('.chip[data-filter]');
  if (chip) {
    boardState.filter = chip.dataset.filter;
    refreshBoardList();
    return;
  }
  if (target.id === 'lb-prev' && lbState.page > 1) {
    lbState.page -= 1;
    refreshLeaderboard();
  } else if (target.id === 'lb-next') {
    lbState.page += 1;
    refreshLeaderboard();
  } else if (target.id === 'retry-btn') {
    render();
  }
});

// The header's profile lookup: a handle goes to its profile route.
document.getElementById('profile-search').addEventListener('submit', (event) => {
  event.preventDefault();
  const handle = new FormData(event.target).get('handle').toString().trim().replace(/^@/, '');
  if (handle) location.hash = `#/u/${encodeURIComponent(handle)}`;
});

window.addEventListener('hashchange', render);
render();
