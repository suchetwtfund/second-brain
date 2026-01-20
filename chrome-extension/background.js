// Configuration
const API_BASE = 'https://telos-deploy.vercel.app'
// const API_BASE = 'http://localhost:3000' // Uncomment for local development

const SUPABASE_URL = 'https://afblclabuyatbyqxklae.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmYmxjbGFidXlhdGJ5cXhrbGFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMzcxMTQsImV4cCI6MjA4MzYxMzExNH0.SbCp13u4NfD1ZIvg2yU2lfNCuUVuH-DtzANWMymbvws'

// Highlight colors for context menu
const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange']

// Cache for highlights by URL
const highlightsCache = new Map()

// ==================== Installation & Setup ====================

chrome.runtime.onInstalled.addListener(() => {
  // Set up side panel to open on action click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(err => console.log('Side panel setup error:', err))

  // Parent menu item
  chrome.contextMenus.create({
    id: 'telos-highlight',
    title: 'Save Highlight to Telos',
    contexts: ['selection']
  })

  // Color submenu items
  HIGHLIGHT_COLORS.forEach(color => {
    chrome.contextMenus.create({
      id: `telos-highlight-${color}`,
      parentId: 'telos-highlight',
      title: color.charAt(0).toUpperCase() + color.slice(1),
      contexts: ['selection']
    })
  })
})

// ==================== Context Menu Handling ====================

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId.startsWith('telos-highlight-')) {
    const color = info.menuItemId.replace('telos-highlight-', '')
    await saveHighlight(tab, info.selectionText, color)
  }
})

// ==================== Keyboard Shortcut ====================

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-highlight') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' })
        if (response?.selectedText) {
          await saveHighlight(tab, response.selectedText, 'yellow')
        } else {
          await showNotification(tab.id, 'No text selected', 'error')
        }
      } catch {
        await showNotification(tab.id, 'Please refresh the page and try again', 'error')
      }
    }
  }
})

// ==================== Message Handling ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveHighlightFromContent') {
    // Save highlight from content script (floating toolbar)
    handleSaveFromContent(sender.tab, request.text, request.color)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ error: err.message }))
    return true // Keep channel open for async
  }

  if (request.action === 'getHighlightsForUrl') {
    // Fetch highlights for a specific URL
    getHighlightsForUrl(request.url)
      .then(highlights => sendResponse({ highlights }))
      .catch(err => sendResponse({ error: err.message, highlights: [] }))
    return true // Keep channel open for async
  }

  if (request.action === 'getCurrentTab') {
    // Get current active tab info for side panel
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => sendResponse({ tab }))
      .catch(err => sendResponse({ error: err.message }))
    return true
  }

  if (request.action === 'scrollToHighlight') {
    // Forward scroll request to content script
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'scrollToHighlight',
            highlightId: request.highlightId
          })
        }
        sendResponse({ success: true })
      })
      .catch(err => sendResponse({ error: err.message }))
    return true
  }

  if (request.action === 'deleteHighlight') {
    // Delete highlight from API
    deleteHighlight(request.highlightId)
      .then(() => {
        // Remove from page
        chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'removeHighlight',
              highlightId: request.highlightId
            })
          }
        })
        // Invalidate cache
        clearHighlightsCache()
        sendResponse({ success: true })
      })
      .catch(err => sendResponse({ error: err.message }))
    return true
  }

  if (request.action === 'updateHighlightColor') {
    // Update highlight color in API
    updateHighlightColor(request.highlightId, request.color)
      .then(() => {
        // Update on page
        chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'updateHighlightColor',
              highlightId: request.highlightId,
              color: request.color
            })
          }
        })
        // Invalidate cache
        clearHighlightsCache()
        sendResponse({ success: true })
      })
      .catch(err => sendResponse({ error: err.message }))
    return true
  }
})

// ==================== Highlight Operations ====================

async function handleSaveFromContent(tab, text, color) {
  const result = await saveHighlight(tab, text, color)

  // Notify side panel to refresh if save was successful
  if (result?.highlight) {
    notifySidePanelUpdate()
  }

  return result
}

async function saveHighlight(tab, text, color) {
  if (!text?.trim()) {
    await showNotification(tab.id, 'No text selected', 'error')
    return { error: 'No text selected' }
  }

  const { session } = await chrome.storage.local.get(['session'])

  if (!session?.access_token) {
    await showNotification(tab.id, 'Please sign in to Telos first', 'error')
    return { error: 'Not signed in' }
  }

  const isValid = await verifySession(session)
  if (!isValid) {
    await showNotification(tab.id, 'Session expired. Please sign in again', 'error')
    return { error: 'Session expired' }
  }

  try {
    const requestBody = {
      url: tab.url,
      title: tab.title,
      text: text.trim(),
      color,
    }

    console.log('Saving highlight:', { url: tab.url, color, textLength: text.length })

    const response = await fetch(`${API_BASE}/api/highlights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()

    if (!response.ok) {
      let errorMessage = 'Failed to save highlight'
      if (responseText) {
        try {
          const errorData = JSON.parse(responseText)
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = responseText || errorMessage
        }
      }
      throw new Error(errorMessage)
    }

    const result = responseText ? JSON.parse(responseText) : {}
    console.log('Highlight saved:', result)

    // Invalidate cache for this URL
    highlightsCache.delete(normalizeUrl(tab.url))

    await showNotification(tab.id, 'Highlight saved!', 'success')
    return result
  } catch (error) {
    console.error('Save highlight error:', error)
    await showNotification(tab.id, error.message || 'Failed to save highlight', 'error')
    return { error: error.message }
  }
}

async function getHighlightsForUrl(url) {
  const normalizedUrl = normalizeUrl(url)

  // Check cache first
  if (highlightsCache.has(normalizedUrl)) {
    const cached = highlightsCache.get(normalizedUrl)
    // Cache valid for 5 minutes
    if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.highlights
    }
  }

  const { session } = await chrome.storage.local.get(['session'])

  if (!session?.access_token) {
    return []
  }

  try {
    const response = await fetch(`${API_BASE}/api/highlights?url=${encodeURIComponent(url)}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    })

    if (!response.ok) {
      console.error('Failed to fetch highlights:', response.status)
      return []
    }

    const data = await response.json()
    const highlights = data.highlights || []

    // Update cache
    highlightsCache.set(normalizedUrl, {
      highlights,
      timestamp: Date.now()
    })

    return highlights
  } catch (error) {
    console.error('Fetch highlights error:', error)
    return []
  }
}

async function deleteHighlight(highlightId) {
  console.log('[Telos BG] deleteHighlight called for:', highlightId)

  const { session } = await chrome.storage.local.get(['session'])

  if (!session?.access_token) {
    throw new Error('Not signed in')
  }

  console.log('[Telos BG] Calling DELETE API for highlight:', highlightId)

  const response = await fetch(`${API_BASE}/api/highlights/${highlightId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  })

  console.log('[Telos BG] Delete response status:', response.status)

  if (!response.ok) {
    const text = await response.text()
    console.log('[Telos BG] Delete error:', text)
    throw new Error(text || 'Failed to delete highlight')
  }

  console.log('[Telos BG] Delete successful')
}

async function updateHighlightColor(highlightId, color) {
  const { session } = await chrome.storage.local.get(['session'])

  if (!session?.access_token) {
    throw new Error('Not signed in')
  }

  const response = await fetch(`${API_BASE}/api/highlights/${highlightId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ color }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Failed to update highlight')
  }
}

function clearHighlightsCache() {
  highlightsCache.clear()
}

function normalizeUrl(url) {
  // Remove hash and trailing slashes for consistent caching
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    return parsed.toString().replace(/\/+$/, '')
  } catch {
    return url
  }
}

// ==================== Side Panel Communication ====================

function notifySidePanelUpdate() {
  // Send message to side panel to refresh highlights
  chrome.runtime.sendMessage({ action: 'highlightsUpdated' }).catch(() => {
    // Side panel might not be open
  })
}

// ==================== Tab Events ====================

// Notify side panel when tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  notifySidePanelUpdate()
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    notifySidePanelUpdate()
  }
})

// ==================== Session Management ====================

async function verifySession(session) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    })

    if (response.ok) return true

    if (session.refresh_token) {
      return await refreshSession(session)
    }

    return false
  } catch {
    return false
  }
}

async function refreshSession(session) {
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
    await chrome.storage.local.set({ session: data })
    return true
  } catch {
    return false
  }
}

// ==================== Notification ====================

async function showNotification(tabId, message, type) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'showNotification',
      message,
      type
    })
  } catch {
    console.log('Could not show notification:', message)
  }
}
