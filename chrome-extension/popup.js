// Configuration
const API_BASE = 'https://telos-deploy.vercel.app'
// const API_BASE = 'http://localhost:3000' // Uncomment for local development

const SUPABASE_URL = 'https://afblclabuyatbyqxklae.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmYmxjbGFidXlhdGJ5cXhrbGFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMzcxMTQsImV4cCI6MjA4MzYxMzExNH0.SbCp13u4NfD1ZIvg2yU2lfNCuUVuH-DtzANWMymbvws'

// DOM Elements
const loginView = document.getElementById('loginView')
const savingView = document.getElementById('savingView')
const successView = document.getElementById('successView')
const errorView = document.getElementById('errorView')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const loginBtn = document.getElementById('loginBtn')
const openAppBtn = document.getElementById('openAppBtn')
const loginError = document.getElementById('loginError')
const savingPageTitle = document.getElementById('savingPageTitle')
const savingPageUrl = document.getElementById('savingPageUrl')
const progressFill = document.getElementById('progressFill')
const savingStatus = document.getElementById('savingStatus')
const errorText = document.getElementById('errorText')
const retryBtn = document.getElementById('retryBtn')
const openAppFromError = document.getElementById('openAppFromError')

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
      // Immediately start saving
      startSaving()
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
retryBtn.addEventListener('click', startSaving)
openAppFromError.addEventListener('click', () => {
  chrome.tabs.create({ url: API_BASE })
})

// Handle Enter key in inputs
emailInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') passwordInput.focus()
})
passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleLogin()
})

// View Functions
function showLoginView() {
  loginView.classList.add('active')
  savingView.classList.remove('active')
  successView.classList.remove('active')
  errorView.classList.remove('active')
}

function showSavingView() {
  loginView.classList.remove('active')
  savingView.classList.add('active')
  successView.classList.remove('active')
  errorView.classList.remove('active')

  // Show current page info
  savingPageTitle.textContent = currentTab?.title || 'Unknown page'
  savingPageUrl.textContent = currentTab?.url || ''
}

function showSuccessView() {
  loginView.classList.remove('active')
  savingView.classList.remove('active')
  successView.classList.add('active')
  errorView.classList.remove('active')

  // Auto-close after 1.2 seconds
  setTimeout(() => {
    window.close()
  }, 1200)
}

function showErrorView(message) {
  loginView.classList.remove('active')
  savingView.classList.remove('active')
  successView.classList.remove('active')
  errorView.classList.add('active')
  errorText.textContent = message || 'Something went wrong'
}

function showError(element, message) {
  element.textContent = message
  element.classList.add('show')
}

function hideError(element) {
  element.classList.remove('show')
}

// Progress Animation
function setProgress(percent, status) {
  progressFill.style.width = `${percent}%`
  if (status) {
    savingStatus.textContent = status
  }
}

// Session Functions
async function verifySession() {
  try {
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

// Login Handler
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

    // Immediately start saving after login
    startSaving()
  } catch (error) {
    showError(loginError, error.message)
  } finally {
    loginBtn.disabled = false
    loginBtn.textContent = 'Sign In'
  }
}

// Save Handler - starts immediately
async function startSaving() {
  if (!currentTab?.url) {
    showErrorView('No URL to save')
    return
  }

  showSavingView()
  setProgress(10, 'Fetching page info...')

  try {
    // Fetch metadata
    setProgress(30, 'Fetching page info...')
    const metadataResponse = await fetch(
      `${API_BASE}/api/metadata?url=${encodeURIComponent(currentTab.url)}`
    )

    let metadata = {}
    if (metadataResponse.ok) {
      metadata = await metadataResponse.json()
    }

    setProgress(60, 'Saving to Telos...')

    // Save to Supabase
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

    setProgress(90, 'Almost done...')

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to save')
    }

    setProgress(100, 'Done!')

    // Brief delay to show completion
    setTimeout(() => {
      showSuccessView()
    }, 200)
  } catch (error) {
    showErrorView(error.message)
  }
}
