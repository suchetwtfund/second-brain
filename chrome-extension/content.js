// Content script for Telos extension
// Handles text selection, floating toolbar, visual highlighting, and notifications

const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange']

// Track current selection and toolbar state
let currentSelection = null
let toolbar = null
let isApplyingHighlights = false
let selectionTimeout = null
let selectionPollInterval = null
let lastSelectionText = ''

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
  document.addEventListener('mousedown', handleMouseDown, true)

  // Also listen on window for edge cases
  window.addEventListener('mouseup', handleSelectionChange, true)

  // Listen for hover on highlights (using event delegation)
  document.addEventListener('mouseover', handleHighlightHover, true)
  document.addEventListener('mouseout', handleHighlightMouseOut, true)

  // For complex sites like Twitter/Substack that intercept events,
  // use polling as a fallback to detect selections
  startSelectionPolling()
}

// Polling fallback for sites that block selection events
function startSelectionPolling() {
  // Poll every 250ms to check for selection changes
  selectionPollInterval = setInterval(() => {
    try {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const selectedText = selection.toString().trim()

      // If we have a new non-empty selection that's different from last time
      if (selectedText && selectedText.length > 0 && selectedText !== lastSelectionText) {
        // Only show toolbar if we don't already have one
        if (!toolbar) {
          console.log('[Telos] Selection detected via polling:', selectedText.substring(0, 50))
          lastSelectionText = selectedText
          showToolbar(selection)
        }
      } else if (!selectedText && lastSelectionText) {
        // Selection was cleared
        lastSelectionText = ''
      }
    } catch (e) {
      // Silently ignore errors in polling
    }
  }, 250)
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
    // Update lastSelectionText so polling doesn't duplicate
    lastSelectionText = selectedText
    console.log('[Telos] Selection detected:', selectedText.substring(0, 50))
    showToolbar(selection)
  }
}

// Check if extension context is still valid
function isExtensionContextValid() {
  try {
    return chrome.runtime && !!chrome.runtime.id
  } catch {
    return false
  }
}

function showToolbar(selection) {
  // Remove existing toolbar (but don't reset lastSelectionText yet)
  if (toolbar) {
    toolbar.remove()
    toolbar = null
  }

  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    console.log('[Telos] Extension context invalidated, please refresh the page')
    return
  }

  try {
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    console.log('[Telos] Selection rect:', rect.width, rect.height, rect.top, rect.left)

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

    // Apply critical inline styles as fallback (in case CSS doesn't load)
    toolbar.style.cssText = `
      position: fixed !important;
      z-index: 2147483647 !important;
      background: #1f2937 !important;
      border-radius: 8px !important;
      padding: 6px 8px !important;
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.24) !important;
      pointer-events: auto !important;
      visibility: visible !important;
      opacity: 1 !important;
    `

    // Color values for inline styles
    const colorValues = {
      yellow: '#facc15',
      green: '#22c55e',
      blue: '#3b82f6',
      pink: '#ec4899',
      orange: '#f97316'
    }

    // Add color buttons
    HIGHLIGHT_COLORS.forEach(color => {
      const btn = document.createElement('button')
      btn.className = `telos-toolbar-color telos-color-${color}`
      btn.setAttribute('data-color', color)
      btn.setAttribute('type', 'button')
      // Inline styles as fallback
      btn.style.cssText = `
        width: 24px !important;
        height: 24px !important;
        min-width: 24px !important;
        min-height: 24px !important;
        border-radius: 50% !important;
        border: 2px solid transparent !important;
        cursor: pointer !important;
        background: ${colorValues[color]} !important;
        pointer-events: auto !important;
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        padding: 0 !important;
        margin: 0 !important;
      `
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

    // Add divider and logo (skip logo if context invalid)
    const divider = document.createElement('div')
    divider.className = 'telos-toolbar-divider'
    divider.style.cssText = `
      width: 1px !important;
      height: 20px !important;
      background: rgba(255, 255, 255, 0.2) !important;
      margin: 0 4px !important;
    `
    toolbar.appendChild(divider)

    try {
      const logo = document.createElement('img')
      logo.className = 'telos-toolbar-logo'
      logo.src = chrome.runtime.getURL('icons/icon-32.png')
      logo.alt = 'Telos'
      logo.style.cssText = `
        width: 20px !important;
        height: 20px !important;
        margin-left: 2px !important;
        opacity: 0.7 !important;
      `
      toolbar.appendChild(logo)
    } catch {
      // Skip logo if extension context is invalid
    }

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

    console.log('[Telos] Toolbar shown at', top, left, 'selection:', currentSelection.text.substring(0, 30))
  } catch (e) {
    console.log('[Telos] Error showing toolbar:', e.message)
  }
}

function hideToolbar() {
  if (toolbar) {
    toolbar.remove()
    toolbar = null
    // Reset lastSelectionText when user intentionally hides toolbar
    // (after a small delay to avoid immediate re-triggering from polling)
    setTimeout(() => {
      if (!toolbar) {
        lastSelectionText = ''
      }
    }, 500)
  }
}

// ==================== Highlight Hover Toolbar ====================

let hoveredHighlightId = null

function handleHighlightHover(e) {
  const highlight = e.target.closest('.telos-highlight')
  if (!highlight) return

  // Don't show if already showing toolbar for new selection
  if (toolbar && !hoveredHighlightId) return

  const highlightId = highlight.getAttribute('data-telos-highlight-id')
  if (!highlightId || highlightId.startsWith('temp-')) return

  // Get current color from the highlight
  let currentColor = 'yellow'
  HIGHLIGHT_COLORS.forEach(color => {
    if (highlight.classList.contains(`telos-highlight-${color}`)) {
      currentColor = color
    }
  })

  showHighlightEditToolbar(highlight, highlightId, currentColor)
}

function handleHighlightMouseOut(e) {
  // Don't hide if moving to toolbar
  const relatedTarget = e.relatedTarget
  if (relatedTarget?.closest('#telos-toolbar')) return

  // Small delay to allow moving to toolbar
  setTimeout(() => {
    if (toolbar && hoveredHighlightId) {
      const toolbarHovered = toolbar.matches(':hover')
      const highlightHovered = document.querySelector('.telos-highlight:hover')
      if (!toolbarHovered && !highlightHovered) {
        hideToolbar()
        hoveredHighlightId = null
      }
    }
  }, 100)
}

function showHighlightEditToolbar(highlight, highlightId, currentColor) {
  hideToolbar()
  hoveredHighlightId = highlightId

  if (!isExtensionContextValid()) return

  const rect = highlight.getBoundingClientRect()

  toolbar = document.createElement('div')
  toolbar.id = 'telos-toolbar'
  toolbar.setAttribute('data-telos-extension', 'true')
  toolbar.setAttribute('data-editing-highlight', highlightId)

  // Add color buttons
  HIGHLIGHT_COLORS.forEach(color => {
    const btn = document.createElement('button')
    btn.className = `telos-toolbar-color telos-color-${color}`
    if (color === currentColor) {
      btn.style.border = '2px solid white'
    }
    btn.setAttribute('data-color', color)
    btn.setAttribute('type', 'button')
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      changeHighlightColor(highlightId, color)
    })
    toolbar.appendChild(btn)
  })

  // Add divider
  const divider = document.createElement('div')
  divider.className = 'telos-toolbar-divider'
  toolbar.appendChild(divider)

  // Add delete button
  const deleteBtn = document.createElement('button')
  deleteBtn.className = 'telos-toolbar-delete'
  deleteBtn.title = 'Remove highlight'
  deleteBtn.textContent = '×'
  deleteBtn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })
  deleteBtn.addEventListener('click', (e) => {
    console.log('[Telos] Delete button clicked for:', highlightId)
    e.preventDefault()
    e.stopPropagation()
    deleteHighlight(highlightId)
  })
  toolbar.appendChild(deleteBtn)

  // Keep toolbar visible when hovering over it
  toolbar.addEventListener('mouseleave', () => {
    setTimeout(() => {
      const highlightHovered = document.querySelector('.telos-highlight:hover')
      if (!highlightHovered && toolbar && !toolbar.matches(':hover')) {
        hideToolbar()
        hoveredHighlightId = null
      }
    }, 100)
  })

  document.body.appendChild(toolbar)

  // Position toolbar above the highlight
  const toolbarRect = toolbar.getBoundingClientRect()
  let top = rect.top - toolbarRect.height - 8
  let left = rect.left + (rect.width / 2) - (toolbarRect.width / 2)

  if (top < 10) {
    top = rect.bottom + 8
    toolbar.classList.add('telos-toolbar-below')
  }

  left = Math.max(10, Math.min(left, window.innerWidth - toolbarRect.width - 10))

  toolbar.style.top = `${top}px`
  toolbar.style.left = `${left}px`
}

function changeHighlightColor(highlightId, newColor) {
  if (!isExtensionContextValid()) {
    showNotification('Please refresh the page to use Telos', 'error')
    return
  }

  chrome.runtime.sendMessage({
    action: 'updateHighlightColor',
    highlightId: highlightId,
    color: newColor
  }, (response) => {
    if (response?.success) {
      updateHighlightColor(highlightId, newColor)
      hideToolbar()
      hoveredHighlightId = null
    }
  })
}

function deleteHighlight(highlightId) {
  console.log('[Telos] deleteHighlight called for:', highlightId)

  hideToolbar()
  hoveredHighlightId = null

  if (!isExtensionContextValid()) {
    showNotification('Please refresh the page to use Telos', 'error')
    return
  }

  chrome.runtime.sendMessage({
    action: 'deleteHighlight',
    highlightId: highlightId
  }, (response) => {
    console.log('[Telos] deleteHighlight response:', response)
    if (response?.success) {
      removeHighlightFromPage(highlightId)
      showNotification('Highlight removed', 'success')
    } else {
      console.log('[Telos] Delete failed:', response?.error)
      showNotification('Failed to remove highlight', 'error')
    }
  })
}

function saveHighlightWithColor(color) {
  console.log('[Telos] saveHighlightWithColor:', color)

  if (!isExtensionContextValid()) {
    console.log('[Telos] Extension context invalidated, please refresh the page')
    showNotification('Please refresh the page to use Telos', 'error')
    return
  }

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
  if (!isExtensionContextValid()) {
    console.log('[Telos] Extension context invalidated, cannot load highlights')
    return
  }

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
  console.log('[Telos] applyHighlightByText:', text.substring(0, 50))

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

        // Skip hidden elements
        const style = window.getComputedStyle(parent)
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT
        }

        return NodeFilter.FILTER_ACCEPT
      }
    }
  )

  // Collect all text nodes with their positions
  const textNodes = []
  let node
  while ((node = walker.nextNode())) {
    const nodeText = node.textContent
    if (nodeText && nodeText.trim()) {
      textNodes.push({
        node,
        text: nodeText,
      })
    }
  }

  // Build accumulated text WITHOUT extra spaces - concatenate exactly as-is
  let accumulatedText = ''
  let nodePositions = [] // Track where each node's text starts/ends in accumulated string

  for (const tn of textNodes) {
    nodePositions.push({
      node: tn.node,
      text: tn.text,
      start: accumulatedText.length,
      end: accumulatedText.length + tn.text.length
    })
    accumulatedText += tn.text
  }

  // Normalize both the search text and accumulated text for matching
  const normalizedSearchText = normalizeTextAggressive(text)
  const normalizedAccumulated = normalizeTextAggressive(accumulatedText)

  console.log('[Telos] Search text (normalized):', normalizedSearchText.substring(0, 80))
  console.log('[Telos] Accumulated length:', normalizedAccumulated.length)

  // Try to find the match in the normalized accumulated text
  let matchIndex = normalizedAccumulated.indexOf(normalizedSearchText)

  // If not found, try with flexible whitespace regex
  if (matchIndex === -1) {
    // Escape regex special chars, then replace spaces with flexible whitespace pattern
    const escaped = normalizedSearchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const flexPattern = escaped.replace(/ /g, '[\\s\\u00A0\\u200B]*')
    try {
      const regex = new RegExp(flexPattern, 'i')
      const match = normalizedAccumulated.match(regex)
      if (match) {
        matchIndex = match.index
        console.log('[Telos] Found with flexible regex at:', matchIndex)
      }
    } catch (e) {
      console.log('[Telos] Regex error:', e.message)
    }
  }

  if (matchIndex === -1) {
    console.log('[Telos] Text not found in page')
    console.log('[Telos] Search:', normalizedSearchText.substring(0, 100))
    console.log('[Telos] Page sample:', normalizedAccumulated.substring(0, 300))
    return false
  }

  console.log('[Telos] Found match at normalized index:', matchIndex)

  // Map normalized index back to original accumulated text position
  const origMatchStart = mapNormalizedIndexToOriginal(accumulatedText, matchIndex)
  const origMatchEnd = mapNormalizedIndexToOriginal(accumulatedText, matchIndex + normalizedSearchText.length)

  console.log('[Telos] Original position:', origMatchStart, '-', origMatchEnd)

  // Find which nodes contain the match and wrap them
  let highlightApplied = false

  for (const np of nodePositions) {
    // Check if this node overlaps with our match range
    if (np.end <= origMatchStart || np.start >= origMatchEnd) {
      continue // No overlap
    }

    // Calculate the portion of this node to highlight
    const highlightStart = Math.max(0, origMatchStart - np.start)
    const highlightEnd = Math.min(np.text.length, origMatchEnd - np.start)

    if (highlightStart >= highlightEnd) continue

    try {
      const range = document.createRange()
      range.setStart(np.node, highlightStart)
      range.setEnd(np.node, highlightEnd)

      const wrapper = document.createElement('span')
      wrapper.className = `telos-highlight telos-highlight-${color}`
      wrapper.setAttribute('data-telos-highlight-id', highlightId)

      range.surroundContents(wrapper)
      highlightApplied = true
      console.log('[Telos] Wrapped text in node:', np.text.substring(highlightStart, highlightEnd).substring(0, 30))
    } catch (e) {
      console.log('[Telos] Failed to wrap node:', e.message)
    }
  }

  if (highlightApplied) {
    console.log('[Telos] Highlight applied via text matching')
    const highlight = document.querySelector(`[data-telos-highlight-id="${highlightId}"]`)
    if (highlight) flashHighlight(highlight)
  }

  return highlightApplied
}

// Aggressive normalization - remove all weird whitespace and invisible chars
function normalizeTextAggressive(text) {
  return text
    // Replace all types of whitespace with regular space
    .replace(/[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, ' ')
    // Remove zero-width characters
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    // Collapse multiple spaces to single space
    .replace(/ +/g, ' ')
    .trim()
}

// Map a position in normalized text back to original text
function mapNormalizedIndexToOriginal(originalText, normalizedIndex) {
  let origIndex = 0
  let normCount = 0
  let inWhitespace = false

  while (normCount < normalizedIndex && origIndex < originalText.length) {
    const char = originalText[origIndex]
    const isWhitespace = /[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/.test(char)
    const isZeroWidth = /[\u200B\u200C\u200D\uFEFF]/.test(char)

    if (isZeroWidth) {
      // Skip zero-width chars entirely
      origIndex++
      continue
    }

    if (isWhitespace) {
      if (!inWhitespace) {
        // First whitespace in a sequence counts as one space in normalized
        normCount++
        inWhitespace = true
      }
      // Additional whitespace chars don't increment normCount
    } else {
      normCount++
      inWhitespace = false
    }
    origIndex++
  }

  // Skip any trailing zero-width characters
  while (origIndex < originalText.length && /[\u200B\u200C\u200D\uFEFF]/.test(originalText[origIndex])) {
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
