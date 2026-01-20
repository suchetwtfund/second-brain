// Side Panel Script for Telos Extension

const SUPABASE_URL = 'https://afblclabuyatbyqxklae.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmYmxjbGFidXlhdGJ5cXhrbGFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMzcxMTQsImV4cCI6MjA4MzYxMzExNH0.SbCp13u4NfD1ZIvg2yU2lfNCuUVuH-DtzANWMymbvws'

const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange']

let currentTab = null
let currentUser = null
let highlights = []

// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', init)

async function init() {
  // Check session and load UI
  await checkSession()

  // Get current tab info
  await loadCurrentTab()

  // Listen for updates
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'highlightsUpdated') {
      loadHighlights()
    }
  })
}

// ==================== Session Management ====================

async function checkSession() {
  const { session } = await chrome.storage.local.get(['session'])

  if (session?.access_token) {
    // Verify the session is still valid
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
      })

      if (response.ok) {
        const user = await response.json()
        currentUser = user
        renderHighlightsView()
        loadHighlights()
        return
      }
    } catch {
      // Session invalid
    }
  }

  // Not logged in
  currentUser = null
  renderLoginForm()
}

function renderLoginForm() {
  const content = document.getElementById('content')
  content.innerHTML = `
    <div class="login-container">
      <div class="login-title">Sign in to Telos</div>
      <form id="login-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" required placeholder="you@example.com">
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" required placeholder="Your password">
        </div>
        <div id="login-error" class="login-error"></div>
        <button type="submit" class="btn btn-primary" id="login-btn">Sign In</button>
      </form>
    </div>
  `

  document.getElementById('login-form').addEventListener('submit', handleLogin)
}

async function handleLogin(e) {
  e.preventDefault()

  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const errorEl = document.getElementById('login-error')
  const submitBtn = document.getElementById('login-btn')

  errorEl.textContent = ''
  submitBtn.disabled = true
  submitBtn.textContent = 'Signing in...'

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error_description || data.message || 'Login failed')
    }

    // Save session
    await chrome.storage.local.set({ session: data })
    currentUser = data.user

    renderHighlightsView()
    loadHighlights()
  } catch (error) {
    errorEl.textContent = error.message
    submitBtn.disabled = false
    submitBtn.textContent = 'Sign In'
  }
}

async function handleLogout() {
  await chrome.storage.local.remove(['session'])
  currentUser = null
  renderLoginForm()
}

// ==================== Tab & Highlights ====================

async function loadCurrentTab() {
  chrome.runtime.sendMessage({ action: 'getCurrentTab' }, (response) => {
    if (response?.tab) {
      currentTab = response.tab
      updatePageInfo()
      loadHighlights()
    }
  })
}

function updatePageInfo() {
  const titleEl = document.getElementById('page-title')
  const urlEl = document.getElementById('page-url')

  if (currentTab) {
    titleEl.textContent = currentTab.title || 'Unknown page'
    urlEl.textContent = currentTab.url || ''
  } else {
    titleEl.textContent = 'No page loaded'
    urlEl.textContent = ''
  }
}

function loadHighlights() {
  console.log('[Telos Side Panel] loadHighlights called')
  console.log('[Telos Side Panel] currentTab:', currentTab?.url)
  console.log('[Telos Side Panel] currentUser:', currentUser?.email)

  if (!currentTab?.url || !currentUser) {
    console.log('[Telos Side Panel] Missing tab or user, showing empty')
    renderHighlightsList([])
    return
  }

  chrome.runtime.sendMessage({
    action: 'getHighlightsForUrl',
    url: currentTab.url
  }, (response) => {
    console.log('[Telos Side Panel] Got response:', response)
    if (response?.highlights) {
      highlights = response.highlights
      console.log('[Telos Side Panel] Rendering', highlights.length, 'highlights')
      renderHighlightsList(highlights)
    } else {
      console.log('[Telos Side Panel] No highlights in response')
      renderHighlightsList([])
    }
  })
}

function renderHighlightsView() {
  const content = document.getElementById('content')
  content.innerHTML = `
    <div class="highlights-container">
      ${currentUser ? `
        <div class="user-info">
          <span class="user-email">${escapeHtml(currentUser.email)}</span>
          <button class="logout-btn" id="logout-btn">Sign out</button>
        </div>
      ` : ''}
      <div id="highlights-list">
        <div class="loading">
          <div class="spinner"></div>
          <div>Loading highlights...</div>
        </div>
      </div>
    </div>
  `

  if (currentUser) {
    document.getElementById('logout-btn').addEventListener('click', handleLogout)
  }
}

function renderHighlightsList(highlights) {
  const listEl = document.getElementById('highlights-list')

  if (!listEl) return

  if (highlights.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128466;</div>
        <div class="empty-title">No highlights yet</div>
        <div class="empty-description">
          Select text on the page and click a color to save a highlight.
        </div>
      </div>
    `
    return
  }

  listEl.innerHTML = `
    <div class="highlights-header">
      <span class="highlights-count">${highlights.length} highlight${highlights.length !== 1 ? 's' : ''}</span>
    </div>
    ${highlights.map(h => renderHighlightCard(h)).join('')}
  `

  // Add event listeners
  listEl.querySelectorAll('.highlight-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking on color picker or delete
      if (e.target.closest('.color-dot') || e.target.closest('.delete-btn')) return
      scrollToHighlight(card.dataset.id)
    })
  })

  listEl.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation()
      const highlightId = dot.closest('.highlight-card').dataset.id
      const color = dot.dataset.color
      updateHighlightColor(highlightId, color)
    })
  })

  listEl.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const highlightId = btn.closest('.highlight-card').dataset.id
      deleteHighlight(highlightId)
    })
  })
}

function renderHighlightCard(highlight) {
  const timeAgo = formatTimeAgo(highlight.created_at)

  return `
    <div class="highlight-card color-${highlight.color}" data-id="${highlight.id}">
      <div class="highlight-text">${escapeHtml(highlight.text)}</div>
      <div class="highlight-actions">
        <div class="color-picker">
          ${HIGHLIGHT_COLORS.map(color => `
            <div class="color-dot ${color} ${color === highlight.color ? 'selected' : ''}"
                 data-color="${color}" title="${color}"></div>
          `).join('')}
        </div>
        <span class="highlight-time">${timeAgo}</span>
        <button class="delete-btn" title="Delete highlight">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  `
}

// ==================== Actions ====================

function scrollToHighlight(highlightId) {
  chrome.runtime.sendMessage({
    action: 'scrollToHighlight',
    highlightId: highlightId
  })
}

function deleteHighlight(highlightId) {
  chrome.runtime.sendMessage({
    action: 'deleteHighlight',
    highlightId: highlightId
  }, (response) => {
    if (response?.success) {
      // Remove from local list and re-render
      highlights = highlights.filter(h => h.id !== highlightId)
      renderHighlightsList(highlights)
    }
  })
}

function updateHighlightColor(highlightId, color) {
  chrome.runtime.sendMessage({
    action: 'updateHighlightColor',
    highlightId: highlightId,
    color: color
  }, (response) => {
    if (response?.success) {
      // Update local list and re-render
      const highlight = highlights.find(h => h.id === highlightId)
      if (highlight) {
        highlight.color = color
        renderHighlightsList(highlights)
      }
    }
  })
}

// ==================== Utilities ====================

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

// Listen for tab changes
chrome.tabs.onActivated.addListener(() => {
  loadCurrentTab()
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    loadCurrentTab()
  }
})
