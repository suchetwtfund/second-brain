// Configuration
const API_BASE = 'https://telos-deploy.vercel.app'
// const API_BASE = 'http://localhost:3000' // Uncomment for local development

const SUPABASE_URL = 'https://afblclabuyatbyqxklae.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmYmxjbGFidXlhdGJ5cXhrbGFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMzcxMTQsImV4cCI6MjA4MzYxMzExNH0.SbCp13u4NfD1ZIvg2yU2lfNCuUVuH-DtzANWMymbvws'

// Highlight colors for context menu
const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange']

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId.startsWith('telos-highlight-')) {
    const color = info.menuItemId.replace('telos-highlight-', '')
    await saveHighlight(tab, info.selectionText, color)
  }
})

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-highlight') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      // Request selected text from content script
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

// Save highlight to Telos
async function saveHighlight(tab, text, color) {
  if (!text?.trim()) {
    await showNotification(tab.id, 'No text selected', 'error')
    return
  }

  // Get session from storage
  const { session } = await chrome.storage.local.get(['session'])

  if (!session?.access_token) {
    await showNotification(tab.id, 'Please sign in to Telos first', 'error')
    return
  }

  // Verify session is still valid
  const isValid = await verifySession(session)
  if (!isValid) {
    await showNotification(tab.id, 'Session expired. Please sign in again', 'error')
    return
  }

  try {
    // Use our API endpoint which handles auto-creating items
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

    console.log('Highlight API response status:', response.status)

    // Get response text first to avoid JSON parse errors on empty body
    const responseText = await response.text()
    console.log('Highlight API response body:', responseText)

    if (!response.ok) {
      let errorMessage = 'Failed to save highlight'
      if (responseText) {
        try {
          const errorData = JSON.parse(responseText)
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = responseText || errorMessage
        }
      } else if (response.status === 401) {
        errorMessage = 'Session expired. Please sign in again'
      } else if (response.status === 400) {
        errorMessage = 'Invalid request'
      } else if (response.status === 0) {
        errorMessage = 'Network error - check if the API is accessible'
      }
      throw new Error(errorMessage)
    }

    // Parse successful response
    if (responseText) {
      const result = JSON.parse(responseText)
      console.log('Highlight saved:', result)
    }

    await showNotification(tab.id, 'Highlight saved!', 'success')
  } catch (error) {
    console.error('Save highlight error:', error)
    await showNotification(tab.id, error.message || 'Failed to save highlight', 'error')
  }
}

// Verify session is still valid
async function verifySession(session) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    })

    if (response.ok) return true

    // Try to refresh if we have a refresh token
    if (session.refresh_token) {
      return await refreshSession(session)
    }

    return false
  } catch {
    return false
  }
}

// Refresh session token
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

// Show notification via content script
async function showNotification(tabId, message, type) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'showNotification',
      message,
      type
    })
  } catch {
    // Content script might not be loaded yet
    console.log('Could not show notification:', message)
  }
}
