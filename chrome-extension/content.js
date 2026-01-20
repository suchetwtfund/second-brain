// Content script for Telos extension
// Handles text selection, floating toolbar, visual highlighting, and notifications

const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange']

// Track current selection and toolbar state
let currentSelection = null
let toolbar = null
let isApplyingHighlights = false

// ==================== Initialization ====================

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeTelos)

// Also run immediately in case DOM is already loaded
if (document.readyState !== 'loading') {
  initializeTelos()
}

function initializeTelos() {
  // Fetch and apply existing highlights
  loadExistingHighlights()

  // Set up selection listener
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('keyup', handleKeyUp)

  // Hide toolbar on scroll or click outside
  document.addEventListener('scroll', hideToolbar, true)
  document.addEventListener('mousedown', handleMouseDown)
}

// ==================== Message Handling ====================

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelection') {
    const selectedText = window.getSelection()?.toString()
    sendResponse({ selectedText })
  } else if (request.action === 'showNotification') {
    showNotification(request.message, request.type)
    sendResponse({ success: true })
  } else if (request.action === 'scrollToHighlight') {
    scrollToHighlight(request.highlightId)
    sendResponse({ success: true })
  } else if (request.action === 'refreshHighlights') {
    loadExistingHighlights()
    sendResponse({ success: true })
  } else if (request.action === 'removeHighlight') {
    removeHighlightFromPage(request.highlightId)
    sendResponse({ success: true })
  } else if (request.action === 'updateHighlightColor') {
    updateHighlightColor(request.highlightId, request.color)
    sendResponse({ success: true })
  }
  return true // Keep channel open for async response
})

// ==================== Selection & Toolbar ====================

function handleMouseUp(e) {
  // Don't show toolbar if clicking on toolbar itself
  if (toolbar && toolbar.contains(e.target)) return

  // Small delay to let selection settle
  setTimeout(() => {
    const selection = window.getSelection()
    const selectedText = selection?.toString().trim()

    if (selectedText && selectedText.length > 0) {
      showToolbar(selection)
    } else {
      hideToolbar()
    }
  }, 10)
}

function handleKeyUp(e) {
  // Show toolbar after keyboard selection (Shift+Arrow keys)
  if (e.shiftKey) {
    const selection = window.getSelection()
    const selectedText = selection?.toString().trim()

    if (selectedText && selectedText.length > 0) {
      showToolbar(selection)
    }
  }
}

function handleMouseDown(e) {
  // Hide toolbar when clicking outside
  if (toolbar && !toolbar.contains(e.target)) {
    hideToolbar()
  }
}

function showToolbar(selection) {
  hideToolbar()

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()

  // Store selection info for later use
  currentSelection = {
    text: selection.toString().trim(),
    range: range.cloneRange()
  }

  // Create toolbar
  toolbar = document.createElement('div')
  toolbar.id = 'telos-toolbar'

  // Add color buttons
  HIGHLIGHT_COLORS.forEach(color => {
    const btn = document.createElement('button')
    btn.className = `telos-toolbar-color telos-color-${color}`
    btn.setAttribute('data-color', color)
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      saveHighlightWithColor(color)
    })
    toolbar.appendChild(btn)
  })

  // Add divider and logo
  const divider = document.createElement('div')
  divider.className = 'telos-toolbar-divider'
  toolbar.appendChild(divider)

  const logo = document.createElement('img')
  logo.className = 'telos-toolbar-logo'
  logo.src = chrome.runtime.getURL('icons/icon-32.png')
  logo.alt = 'Telos'
  toolbar.appendChild(logo)

  document.body.appendChild(toolbar)

  // Position toolbar above selection (or below if not enough space)
  const toolbarRect = toolbar.getBoundingClientRect()
  const scrollTop = window.scrollY
  const scrollLeft = window.scrollX

  let top = rect.top + scrollTop - toolbarRect.height - 10
  let left = rect.left + scrollLeft + (rect.width / 2) - (toolbarRect.width / 2)

  // If not enough space above, position below
  if (top < scrollTop + 10) {
    top = rect.bottom + scrollTop + 10
    toolbar.classList.add('telos-toolbar-below')
  }

  // Keep within viewport horizontally
  left = Math.max(scrollLeft + 10, Math.min(left, scrollLeft + window.innerWidth - toolbarRect.width - 10))

  toolbar.style.top = `${top}px`
  toolbar.style.left = `${left}px`
}

function hideToolbar() {
  if (toolbar) {
    toolbar.remove()
    toolbar = null
  }
}

function saveHighlightWithColor(color) {
  console.log('[Telos] saveHighlightWithColor called with color:', color)

  if (!currentSelection) {
    console.log('[Telos] No currentSelection')
    return
  }

  const selectionText = currentSelection.text
  const selectionRange = currentSelection.range

  console.log('[Telos] Selection text:', selectionText.substring(0, 50))

  hideToolbar()

  // Generate temporary ID for immediate visual feedback
  const tempId = 'temp-' + Date.now()

  // Try to apply highlight immediately before selection is cleared
  let applied = false
  try {
    applied = applyHighlightToRange(selectionRange, color, tempId)
  } catch (e) {
    console.log('[Telos] Range highlight failed:', e)
  }

  // If range-based highlight failed, use text matching
  if (!applied) {
    console.log('[Telos] Falling back to text matching')
    applyHighlightByText(selectionText, color, tempId)
  }

  // Clear selection
  window.getSelection()?.removeAllRanges()
  currentSelection = null

  // Send message to background to save
  chrome.runtime.sendMessage({
    action: 'saveHighlightFromContent',
    text: selectionText,
    color: color
  }, (response) => {
    if (response?.highlight?.id) {
      // Update temp ID with real ID
      const tempHighlights = document.querySelectorAll(`[data-telos-highlight-id="${tempId}"]`)
      tempHighlights.forEach(el => {
        el.setAttribute('data-telos-highlight-id', response.highlight.id)
      })
    } else if (response?.error) {
      // Remove highlight if save failed
      removeHighlightFromPage(tempId)
    }
  })
}

// ==================== Visual Highlighting ====================

function applyHighlightToRange(range, color, highlightId) {
  // Check if range is valid
  if (!range || range.collapsed) {
    console.log('[Telos] Range is invalid or collapsed')
    return false
  }

  try {
    // Create wrapper span
    const wrapper = document.createElement('span')
    wrapper.className = `telos-highlight telos-highlight-${color}`
    wrapper.setAttribute('data-telos-highlight-id', highlightId)

    // Try to wrap the selection
    range.surroundContents(wrapper)

    // Verify it was applied
    if (wrapper.parentNode) {
      console.log('[Telos] Highlight applied via range')
      flashHighlight(wrapper)
      return true
    }
    return false
  } catch (e) {
    console.log('[Telos] surroundContents failed:', e.message)
    return false
  }
}

function loadExistingHighlights() {
  if (isApplyingHighlights) return
  isApplyingHighlights = true

  chrome.runtime.sendMessage({
    action: 'getHighlightsForUrl',
    url: window.location.href
  }, (response) => {
    isApplyingHighlights = false

    if (response?.highlights && response.highlights.length > 0) {
      // Remove existing Telos highlights first
      document.querySelectorAll('.telos-highlight').forEach(el => {
        const parent = el.parentNode
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el)
        }
        parent.removeChild(el)
      })

      // Apply each highlight
      response.highlights.forEach(highlight => {
        applyHighlightByText(highlight.text, highlight.color, highlight.id)
      })
    }
  })
}

function applyHighlightByText(text, color, highlightId) {
  console.log('[Telos] applyHighlightByText called for:', text.substring(0, 50))

  // Use TreeWalker to find text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip script, style, and already highlighted content
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT

        const tagName = parent.tagName.toLowerCase()
        if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
          return NodeFilter.FILTER_REJECT
        }

        if (parent.closest('.telos-highlight')) {
          return NodeFilter.FILTER_REJECT
        }

        return NodeFilter.FILTER_ACCEPT
      }
    }
  )

  // Normalize text for comparison
  const normalizedSearchText = normalizeText(text)
  let accumulatedText = ''
  let textNodes = []

  // Collect text nodes
  let node
  while ((node = walker.nextNode())) {
    const nodeText = node.textContent
    if (nodeText.trim()) {
      textNodes.push({
        node,
        text: nodeText,
        normalizedText: normalizeText(nodeText),
        start: accumulatedText.length
      })
      accumulatedText += normalizeText(nodeText)
    }
  }

  console.log('[Telos] Collected', textNodes.length, 'text nodes')

  // Find the text in accumulated content
  const matchIndex = accumulatedText.indexOf(normalizedSearchText)
  if (matchIndex === -1) {
    console.log('[Telos] Text not found in page')
    return false
  }

  console.log('[Telos] Found text at index:', matchIndex)
  const matchEnd = matchIndex + normalizedSearchText.length
  let highlightApplied = false

  // Find which text nodes contain this match
  for (let i = 0; i < textNodes.length; i++) {
    const tn = textNodes[i]
    const nodeEnd = tn.start + tn.normalizedText.length

    // Check if this node contains part of the match
    if (nodeEnd > matchIndex && tn.start < matchEnd) {
      // Calculate the portion of this node that's part of the match
      const startInNode = Math.max(0, matchIndex - tn.start)
      const endInNode = Math.min(tn.normalizedText.length, matchEnd - tn.start)

      // Map back to original text positions
      const origStart = mapNormalizedToOriginal(tn.text, startInNode)
      const origEnd = mapNormalizedToOriginal(tn.text, endInNode)

      try {
        const range = document.createRange()
        range.setStart(tn.node, origStart)
        range.setEnd(tn.node, origEnd)

        const wrapper = document.createElement('span')
        wrapper.className = `telos-highlight telos-highlight-${color}`
        wrapper.setAttribute('data-telos-highlight-id', highlightId)

        range.surroundContents(wrapper)
        highlightApplied = true
        console.log('[Telos] Wrapped text node successfully')
      } catch (e) {
        console.log('[Telos] Failed to wrap text node:', e.message)
      }

      // Only highlight the first occurrence
      if (tn.start + endInNode >= matchEnd) break
    }
  }

  if (highlightApplied) {
    console.log('[Telos] Highlight applied via text matching')
    // Flash the highlight
    const highlight = document.querySelector(`[data-telos-highlight-id="${highlightId}"]`)
    if (highlight) flashHighlight(highlight)
  }

  return highlightApplied
}

function normalizeText(text) {
  // Normalize whitespace and remove extra spaces
  return text.replace(/\s+/g, ' ').trim()
}

function mapNormalizedToOriginal(originalText, normalizedIndex) {
  // Map an index in normalized text back to original text
  let origIndex = 0
  let normIndex = 0
  let inWhitespace = false

  while (normIndex < normalizedIndex && origIndex < originalText.length) {
    const char = originalText[origIndex]
    const isSpace = /\s/.test(char)

    if (isSpace) {
      if (!inWhitespace) {
        normIndex++
        inWhitespace = true
      }
    } else {
      normIndex++
      inWhitespace = false
    }
    origIndex++
  }

  return origIndex
}

function scrollToHighlight(highlightId) {
  const highlight = document.querySelector(`[data-telos-highlight-id="${highlightId}"]`)
  if (highlight) {
    highlight.scrollIntoView({ behavior: 'smooth', block: 'center' })
    flashHighlight(highlight)
  }
}

function flashHighlight(element) {
  element.classList.add('telos-highlight-flash')
  setTimeout(() => {
    element.classList.remove('telos-highlight-flash')
  }, 1500)
}

function removeHighlightFromPage(highlightId) {
  const highlights = document.querySelectorAll(`[data-telos-highlight-id="${highlightId}"]`)
  highlights.forEach(el => {
    const parent = el.parentNode
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el)
    }
    parent.removeChild(el)
  })
}

function updateHighlightColor(highlightId, newColor) {
  const highlights = document.querySelectorAll(`[data-telos-highlight-id="${highlightId}"]`)
  highlights.forEach(el => {
    // Remove old color classes
    HIGHLIGHT_COLORS.forEach(color => {
      el.classList.remove(`telos-highlight-${color}`)
    })
    // Add new color class
    el.classList.add(`telos-highlight-${newColor}`)
  })
}

// ==================== Notifications ====================

function showNotification(message, type = 'success') {
  // Remove existing notification if present
  const existing = document.getElementById('telos-notification')
  if (existing) {
    existing.remove()
  }

  // Create notification element
  const notification = document.createElement('div')
  notification.id = 'telos-notification'
  if (type === 'error') {
    notification.classList.add('telos-error')
  }
  notification.innerHTML = `
    <div class="telos-notification-icon">
      ${type === 'success' ? successIcon : errorIcon}
    </div>
    <div class="telos-notification-text">${escapeHtml(message)}</div>
  `

  document.body.appendChild(notification)

  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'telos-slide-out 0.3s ease-out forwards'
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}

// SVG icons
const successIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd" />
  </svg>
`

const errorIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clip-rule="evenodd" />
  </svg>
`

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
