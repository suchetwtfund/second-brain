// Content script for Telos extension
// Handles capturing text selections and showing notifications

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelection') {
    const selectedText = window.getSelection()?.toString()
    sendResponse({ selectedText })
  } else if (request.action === 'showNotification') {
    showNotification(request.message, request.type)
    sendResponse({ success: true })
  }
  return true // Keep channel open for async response
})

// Show toast notification
function showNotification(message, type = 'success') {
  // Remove existing notification if present
  const existing = document.getElementById('telos-notification')
  if (existing) {
    existing.remove()
  }

  // Create notification element
  const notification = document.createElement('div')
  notification.id = 'telos-notification'
  notification.innerHTML = `
    <div class="telos-notification-icon">
      ${type === 'success' ? successIcon : errorIcon}
    </div>
    <div class="telos-notification-text">${escapeHtml(message)}</div>
  `

  // Add styles
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 2147483647;
    animation: telos-slide-in 0.3s ease-out;
    max-width: 300px;
  `

  // Add animation styles if not already present
  if (!document.getElementById('telos-styles')) {
    const style = document.createElement('style')
    style.id = 'telos-styles'
    style.textContent = `
      @keyframes telos-slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes telos-slide-out {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
      .telos-notification-icon svg {
        width: 18px;
        height: 18px;
      }
    `
    document.head.appendChild(style)
  }

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
