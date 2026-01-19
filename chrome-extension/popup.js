// Configuration
const API_BASE = 'https://telos-deploy.vercel.app'
// const API_BASE = 'http://localhost:3000' // Uncomment for local development

const SUPABASE_URL = 'https://afblclabuyatbyqxklae.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmYmxjbGFidXlhdGJ5cXhrbGFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMzcxMTQsImV4cCI6MjA4MzYxMzExNH0.SbCp13u4NfD1ZIvg2yU2lfNCuUVuH-DtzANWMymbvws'

// DOM Elements
const loginView = document.getElementById('loginView')
const saveView = document.getElementById('saveView')
const successView = document.getElementById('successView')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const loginBtn = document.getElementById('loginBtn')
const openAppBtn = document.getElementById('openAppBtn')
const loginError = document.getElementById('loginError')
const pageTitle = document.getElementById('pageTitle')
const pageUrl = document.getElementById('pageUrl')
const saveBtn = document.getElementById('saveBtn')
const saveBtnText = document.getElementById('saveBtnText')
const saveError = document.getElementById('saveError')
const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')

// State
let currentTab = null
let session = null

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  currentTab = tab

  // Check for stored session
  const stored = await chrome.storage.local.get(['session'])
  if (stored.session) {
    session = stored.session
    // Verify session is still valid
    const isValid = await verifySession()
    if (isValid) {
      showSaveView()
    } else {
      await chrome.storage.local.remove(['session'])
      session = null
      showLoginView()
    }
  } else {
    showLoginView()
  }
})

// Event Listeners
loginBtn.addEventListener('click', handleLogin)
openAppBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: API_BASE })
})
saveBtn.addEventListener('click', handleSave)
logoutBtn.addEventListener('click', handleLogout)

// Handle Enter key in inputs
emailInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') passwordInput.focus()
})
passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleLogin()
})

// Functions
function showLoginView() {
  loginView.classList.add('active')
  saveView.classList.remove('active')
  successView.classList.remove('active')
}

function showSaveView() {
  loginView.classList.remove('active')
  saveView.classList.add('active')
  successView.classList.remove('active')

  // Show current page info
  pageTitle.textContent = currentTab?.title || 'Unknown page'
  pageUrl.textContent = currentTab?.url || ''
  userEmail.textContent = session?.user?.email || ''
}

function showSuccessView() {
  loginView.classList.remove('active')
  saveView.classList.remove('active')
  successView.classList.add('active')

  // Auto-close after 1.5 seconds
  setTimeout(() => {
    window.close()
  }, 1500)
}

function showError(element, message) {
  element.textContent = message
  element.classList.add('show')
}

function hideError(element) {
  element.classList.remove('show')
}

async function verifySession() {
  try {
    // First try with current access_token
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    })

    if (response.ok) return true

    // Token expired - try to refresh
    if (session.refresh_token) {
      const refreshed = await refreshSession()
      return refreshed
    }

    return false
  } catch {
    return false
  }
}

async function refreshSession() {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    })

    if (!response.ok) return false

    const data = await response.json()
    session = data
    await chrome.storage.local.set({ session: data })
    return true
  } catch {
    return false
  }
}

async function handleLogin() {
  const email = emailInput.value.trim()
  const password = passwordInput.value

  if (!email || !password) {
    showError(loginError, 'Please enter email and password')
    return
  }

  loginBtn.disabled = true
  loginBtn.innerHTML = '<span class="loading"></span>'
  hideError(loginError)

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
      throw new Error(data.error_description || data.error || 'Login failed')
    }

    // Store session
    session = data
    await chrome.storage.local.set({ session: data })

    showSaveView()
  } catch (error) {
    showError(loginError, error.message)
  } finally {
    loginBtn.disabled = false
    loginBtn.textContent = 'Sign In'
  }
}

async function handleSave() {
  if (!currentTab?.url) {
    showError(saveError, 'No URL to save')
    return
  }

  saveBtn.disabled = true
  saveBtnText.innerHTML = '<span class="loading"></span>'
  hideError(saveError)

  try {
    // First, fetch metadata
    const metadataResponse = await fetch(
      `${API_BASE}/api/metadata?url=${encodeURIComponent(currentTab.url)}`
    )

    let metadata = {}
    if (metadataResponse.ok) {
      metadata = await metadataResponse.json()
    }

    // Save to Supabase directly (faster than going through our API)
    const response = await fetch(`${SUPABASE_URL}/rest/v1/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        user_id: session.user.id,
        type: 'link',
        url: currentTab.url,
        title: metadata.title || currentTab.title || currentTab.url,
        description: metadata.description || null,
        thumbnail: metadata.thumbnail || null,
        content_type: metadata.contentType || 'link',
        status: 'unread',
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to save')
    }

    showSuccessView()
  } catch (error) {
    showError(saveError, error.message)
    saveBtn.disabled = false
    saveBtnText.textContent = 'Save to Telos'
  }
}

async function handleLogout() {
  await chrome.storage.local.remove(['session'])
  session = null
  showLoginView()
}
