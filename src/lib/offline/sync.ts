import {
  getPendingActions,
  removePendingAction,
  cacheItem,
  cacheHighlight,
  getHighlightsForItem,
} from './db'
import type { Item } from '@/lib/supabase/types'

type SyncStatus = 'idle' | 'syncing' | 'error'

let syncStatus: SyncStatus = 'idle'
let listeners: Set<(status: SyncStatus) => void> = new Set()

export function getSyncStatus(): SyncStatus {
  return syncStatus
}

export function onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function setSyncStatus(status: SyncStatus) {
  syncStatus = status
  listeners.forEach(cb => cb(status))
}

export async function syncPendingActions(): Promise<{ success: number; failed: number }> {
  if (syncStatus === 'syncing') {
    return { success: 0, failed: 0 }
  }

  setSyncStatus('syncing')
  const actions = await getPendingActions()
  let success = 0
  let failed = 0

  for (const action of actions) {
    try {
      let response: Response

      switch (action.type) {
        case 'highlight_create':
          response = await fetch('/api/highlights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.payload),
          })
          break

        case 'highlight_update':
          response = await fetch(`/api/highlights/${action.payload.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.payload),
          })
          break

        case 'highlight_delete':
          response = await fetch(`/api/highlights/${action.payload.id}`, {
            method: 'DELETE',
          })
          break

        case 'item_mark_read':
          response = await fetch('/api/items', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: action.payload.id,
              status: action.payload.status,
            }),
          })
          break

        default:
          console.warn('Unknown action type:', action.type)
          continue
      }

      if (response.ok) {
        await removePendingAction(action.id)
        success++
      } else {
        failed++
      }
    } catch (error) {
      console.error('Sync error for action:', action.id, error)
      failed++
    }
  }

  setSyncStatus(failed > 0 ? 'error' : 'idle')
  return { success, failed }
}

// Extract content and cache item for offline reading
export async function saveForOffline(itemId: string): Promise<{ item: Item | null; error?: string }> {
  try {
    // First, extract content if not already done
    const extractResponse = await fetch('/api/content/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    })

    if (!extractResponse.ok) {
      const errorData = await extractResponse.json().catch(() => ({}))
      const errorMessage = errorData.error || `HTTP ${extractResponse.status}`
      console.error('Content extraction failed:', errorMessage)
      return { item: null, error: errorMessage }
    }

    const { item } = await extractResponse.json()

    // Cache the item locally
    await cacheItem(item)

    // Also cache any existing highlights for this item
    const highlightsResponse = await fetch(`/api/highlights?item_id=${itemId}`)
    if (highlightsResponse.ok) {
      const { highlights } = await highlightsResponse.json()
      for (const highlight of highlights) {
        await cacheHighlight(highlight)
      }
    }

    return { item }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to save for offline:', error)
    return { item: null, error: errorMessage }
  }
}

// Check if we're online
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

// Listen for online/offline events
export function setupNetworkListeners(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleOnline = () => {
    onOnline()
    // Auto-sync when coming back online
    syncPendingActions()
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', onOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', onOffline)
  }
}
