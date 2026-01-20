// Content script for Telos extension
// Handles text selection, floating toolbar, visual highlighting, and notifications

const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange']

// Track current selection and toolbar state
let currentSelection = null
let toolbar = null
let highlightTooltip = null
let isApplyingHighlights = false
let selectionTimeout = null

// ==================== Initialization ====================

// Run initialization
initializeTelos()

function initializeTelos() {
  console.log('[Telos] Content script initialized on:', window.location.href)

  // Fetch and apply existing highlights after page is ready
  if (document.readyState === 'complete') {
    loadExistingHighlights()
  } else {
    window.addEventListener('load', loadExistingHighlights)
  }

  // Use multiple event listeners for better coverage on complex sites
  // Capture phase to get events before the site can stop propagation
  document.addEventListener('mouseup', handleSelectionChange, true)
  document.addEventListener('keyup', handleKeyUp, true)
  document.addEventListener('selectionchange', handleSelectionChangeDebounced)

  // Hide toolbar on scroll or click outside
  document.addEventListener('scroll', hideToolbar, true)
  document.addEventListener('scroll', hideHighlightTooltip, true)
  document.addEventListener('mousedown', handleMouseDown, true)

  // Also listen on window for edge cases
  window.addEventListener('mouseup', handleSelectionChange, true)

  // Listen for hover on highlights (using event delegation)
  document.addEventListener('mouseover', handleHighlightHover, true)
  document.addEventListener('mouseout', handleHighlightMouseOut, true)
}

// ==================== Message Handling ====================

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
  return true
})

// ==================== Selection & Toolbar ====================

function handleSelectionChangeDebounced() {
  // Debounce selection change events
  if (selectionTimeout) clearTimeout(selectionTimeout)
  selectionTimeout = setTimeout(checkSelection, 100)
}

function handleSelectionChange(e) {
  // Don't process if clicking on our toolbar
  if (toolbar && (toolbar.contains(e.target) || e.target.closest('#telos-toolbar'))) {
    return
  }

  // Delay to let selection settle (important for complex sites)
  if (selectionTimeout) clearTimeout(selectionTimeout)
  selectionTimeout = setTimeout(checkSelection, 150)
}

function handleKeyUp(e) {
  // Show toolbar after keyboard selection (Shift+Arrow keys, Ctrl+A, etc.)
  if (e.shiftKey || (e.ctrlKey && e.key === 'a') || (e.metaKey && e.key === 'a')) {
    if (selectionTimeout) clearTimeout(selectionTimeout)
    selectionTimeout = setTimeout(checkSelection, 100)
  }
}

function handleMouseDown(e) {
  // Hide toolbar when clicking outside (but not on toolbar itself)
  if (toolbar && !toolbar.contains(e.target) && !e.target.closest('#telos-toolbar')) {
    hideToolbar()
  }
}

function checkSelection() {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) {
    return
  }

  const selectedText = selection.toString().trim()

  if (selectedText && selectedText.length > 0) {
    console.log('[Telos] Selection detected:', selectedText.substring(0, 50))
    showToolbar(selection)
  }
}

function showToolbar(selection) {
  // Remove existing toolbar
  hideToolbar()

  try {
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    // Skip if rect is invalid (can happen on some sites)
    if (rect.width === 0 && rect.height === 0) {
      console.log('[Telos] Invalid selection rect, skipping toolbar')
      return
    }

    // Store selection info for later use
    currentSelection = {
      text: selection.toString().trim(),
      range: range.cloneRange()
    }

    // Create toolbar
    toolbar = document.createElement('div')
    toolbar.id = 'telos-toolbar'
    toolbar.setAttribute('data-telos-extension', 'true')

    // Add color buttons
    HIGHLIGHT_COLORS.forEach(color => {
      const btn = document.createElement('button')
      btn.className = `telos-toolbar-color telos-color-${color}`
      btn.setAttribute('data-color', color)
      btn.setAttribute('type', 'button')
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
      })
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

    // Position toolbar above selection (using fixed positioning - no scroll offset needed)
    const toolbarRect = toolbar.getBoundingClientRect()

    // rect is already in viewport coordinates from getBoundingClientRect
    let top = rect.top - toolbarRect.height - 10
    let left = rect.left + (rect.width / 2) - (toolbarRect.width / 2)

    // If not enough space above, position below the selection
    if (top < 10) {
      top = rect.bottom + 10
      toolbar.classList.add('telos-toolbar-below')
    }

    // Keep within viewport horizontally
    left = Math.max(10, Math.min(left, window.innerWidth - toolbarRect.width - 10))

    // Keep within viewport vertically
    top = Math.max(10, Math.min(top, window.innerHeight - toolbarRect.height - 10))

    toolbar.style.top = `${top}px`
    toolbar.style.left = `${left}px`

    console.log('[Telos] Toolbar shown at', top, left)
  } catch (e) {
    console.log('[Telos] Error showing toolbar:', e.message)
  }
}

function hideToolbar() {
  if (toolbar) {
    toolbar.remove()
    toolbar = null
  }
}

// ==================== Highlight Hover Tooltip ====================

function handleHighlightHover(e) {
  const highlight = e.target.closest('.telos-highlight')
  if (!highlight) return

  // Don't show tooltip if toolbar is visible
  if (toolbar) return

  const highlightId = highlight.getAttribute('data-telos-highlight-id')
  if (!highlightId || highlightId.startsWith('temp-')) return

  showHighlightTooltip(highlight, highlightId)
}

function handleHighlightMouseOut(e) {
  const highlight = e.target.closest('.telos-highlight')
  const tooltip = e.relatedTarget?.closest('#telos-highlight-tooltip')

  // Don't hide if moving to tooltip or within same highlight
  if (tooltip) return

  // Small delay to allow moving to tooltip
  setTimeout(() => {
    if (highlightTooltip && !highlightTooltip.matches(':hover')) {
      const highlightStillHovered = document.querySelector('.telos-highlight:hover')
      if (!highlightStillHovered) {
        hideHighlightTooltip()
      }
    }
  }, 100)
}

function showHighlightTooltip(highlight, highlightId) {
  hideHighlightTooltip()

  const rect = highlight.getBoundingClientRect()

  highlightTooltip = document.createElement('div')
  highlightTooltip.id = 'telos-highlight-tooltip'
  highlightTooltip.setAttribute('data-highlight-id', highlightId)

  // Delete button
  const deleteBtn = document.createElement('button')
  deleteBtn.className = 'telos-tooltip-btn telos-delete-btn'
  deleteBtn.title = 'Remove highlight'
  deleteBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
    </svg>
  `
  deleteBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    deleteHighlightWithConfirm(highlightId)
  })

  highlightTooltip.appendChild(deleteBtn)

  // Keep tooltip visible when hovering over it
  highlightTooltip.addEventListener('mouseleave', () => {
    hideHighlightTooltip()
  })

  document.body.appendChild(highlightTooltip)

  // Position tooltip above the highlight
  const tooltipRect = highlightTooltip.getBoundingClientRect()
  let top = rect.top - tooltipRect.height - 8
  let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2)

  // If not enough space above, position below
  if (top < 10) {
    top = rect.bottom + 8
    highlightTooltip.classList.add('tooltip-below')
  }

  // Keep within viewport
  left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10))

  highlightTooltip.style.top = `${top}px`
  highlightTooltip.style.left = `${left}px`
}

function hideHighlightTooltip() {
  if (highlightTooltip) {
    highlightTooltip.remove()
    highlightTooltip = null
  }
}

function deleteHighlightWithConfirm(highlightId) {
  hideHighlightTooltip()

  // Delete via background script
  chrome.runtime.sendMessage({
    action: 'deleteHighlight',
    highlightId: highlightId
  }, (response) => {
    if (response?.success) {
      removeHighlightFromPage(highlightId)
      showNotification('Highlight removed', 'success')
    } else {
      showNotification('Failed to remove highlight', 'error')
    }
  })
}

function saveHighlightWithColor(color) {
  console.log('[Telos] saveHighlightWithColor:', color)

  if (!currentSelection) {
    console.log('[Telos] No currentSelection')
    return
  }

  const selectionText = currentSelection.text
  const selectionRange = currentSelection.range

  console.log('[Telos] Saving highlight for:', selectionText.substring(0, 50))

  hideToolbar()

  // Generate temporary ID
  const tempId = 'temp-' + Date.now()

  // Try to apply highlight immediately
  let applied = false
  try {
    applied = applyHighlightToRange(selectionRange, color, tempId)
  } catch (e) {
    console.log('[Telos] Range highlight error:', e.message)
  }

  // Fallback to text matching
  if (!applied) {
    console.log('[Telos] Using text matching fallback')
    applied = applyHighlightByText(selectionText, color, tempId)
  }

  // Clear selection
  window.getSelection()?.removeAllRanges()
  currentSelection = null

  // Save to backend
  chrome.runtime.sendMessage({
    action: 'saveHighlightFromContent',
    text: selectionText,
    color: color
  }, (response) => {
    console.log('[Telos] Save response:', response)
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
  if (!range || range.collapsed) {
    console.log('[Telos] Range is invalid or collapsed')
    return false
  }

  try {
    const wrapper = document.createElement('span')
    wrapper.className = `telos-highlight telos-highlight-${color}`
    wrapper.setAttribute('data-telos-highlight-id', highlightId)

    range.surroundContents(wrapper)

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

let pendingHighlights = []
let highlightRetryCount = 0
const MAX_HIGHLIGHT_RETRIES = 5

function loadExistingHighlights() {
  if (isApplyingHighlights) return
  isApplyingHighlights = true
  highlightRetryCount = 0

  console.log('[Telos] Loading existing highlights for:', window.location.href)

  chrome.runtime.sendMessage({
    action: 'getHighlightsForUrl',
    url: window.location.href
  }, (response) => {
    isApplyingHighlights = false

    if (response?.highlights && response.highlights.length > 0) {
      console.log('[Telos] Found', response.highlights.length, 'highlights to apply')
      pendingHighlights = [...response.highlights]
      applyPendingHighlights()
    }
  })
}

function applyPendingHighlights() {
  if (pendingHighlights.length === 0) return

  console.log('[Telos] Applying', pendingHighlights.length, 'pending highlights (attempt', highlightRetryCount + 1, ')')

  // Remove existing Telos highlights first
  document.querySelectorAll('.telos-highlight').forEach(el => {
    const parent = el.parentNode
    if (parent) {
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el)
      }
      parent.removeChild(el)
    }
  })

  // Try to apply each highlight
  const stillPending = []
  pendingHighlights.forEach(highlight => {
    const applied = applyHighlightByText(highlight.text, highlight.color, highlight.id)
    if (!applied) {
      stillPending.push(highlight)
    }
  })

  pendingHighlights = stillPending

  // Retry for dynamic sites if some highlights weren't applied
  if (stillPending.length > 0 && highlightRetryCount < MAX_HIGHLIGHT_RETRIES) {
    highlightRetryCount++
    console.log('[Telos]', stillPending.length, 'highlights not found, retrying in 1s...')
    setTimeout(applyPendingHighlights, 1000)
  } else if (stillPending.length > 0) {
    console.log('[Telos]', stillPending.length, 'highlights could not be applied (text not found on page)')
  }
}

function applyHighlightByText(text, color, highlightId) {
  console.log('[Telos] applyHighlightByText:', text.substring(0, 30))

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT

        const tagName = parent.tagName.toLowerCase()
        if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
          return NodeFilter.FILTER_REJECT
        }

        if (parent.closest('.telos-highlight') || parent.closest('#telos-toolbar')) {
          return NodeFilter.FILTER_REJECT
        }

        return NodeFilter.FILTER_ACCEPT
      }
    }
  )

  const normalizedSearchText = normalizeText(text)
  let accumulatedText = ''
  let textNodes = []

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

  const matchIndex = accumulatedText.indexOf(normalizedSearchText)
  if (matchIndex === -1) {
    console.log('[Telos] Text not found in page')
    return false
  }

  console.log('[Telos] Found text at index:', matchIndex)
  const matchEnd = matchIndex + normalizedSearchText.length
  let highlightApplied = false

  for (let i = 0; i < textNodes.length; i++) {
    const tn = textNodes[i]
    const nodeEnd = tn.start + tn.normalizedText.length

    if (nodeEnd > matchIndex && tn.start < matchEnd) {
      const startInNode = Math.max(0, matchIndex - tn.start)
      const endInNode = Math.min(tn.normalizedText.length, matchEnd - tn.start)
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
      } catch (e) {
        console.log('[Telos] Failed to wrap node:', e.message)
      }

      if (tn.start + endInNode >= matchEnd) break
    }
  }

  if (highlightApplied) {
    console.log('[Telos] Highlight applied via text matching')
    const highlight = document.querySelector(`[data-telos-highlight-id="${highlightId}"]`)
    if (highlight) flashHighlight(highlight)
  }

  return highlightApplied
}

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim()
}

function mapNormalizedToOriginal(originalText, normalizedIndex) {
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
    HIGHLIGHT_COLORS.forEach(color => {
      el.classList.remove(`telos-highlight-${color}`)
    })
    el.classList.add(`telos-highlight-${newColor}`)
  })
}

// ==================== Notifications ====================

function showNotification(message, type = 'success') {
  const existing = document.getElementById('telos-notification')
  if (existing) existing.remove()

  const notification = document.createElement('div')
  notification.id = 'telos-notification'
  if (type === 'error') notification.classList.add('telos-error')

  notification.innerHTML = `
    <div class="telos-notification-icon">
      ${type === 'success' ? successIcon : errorIcon}
    </div>
    <div class="telos-notification-text">${escapeHtml(message)}</div>
  `

  document.body.appendChild(notification)

  setTimeout(() => {
    notification.style.animation = 'telos-slide-out 0.3s ease-out forwards'
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}

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

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
