import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Item, Highlight } from '@/lib/supabase/types'

interface OfflineDB extends DBSchema {
  items: {
    key: string
    value: Item & {
      cachedAt: string
      images?: string[] // Base64 encoded images
    }
    indexes: {
      'by-cached-at': string
    }
  }
  highlights: {
    key: string
    value: Highlight & {
      cachedAt: string
    }
    indexes: {
      'by-item': string
    }
  }
  pendingActions: {
    key: string
    value: {
      id: string
      type: 'highlight_create' | 'highlight_update' | 'highlight_delete' | 'item_mark_read'
      payload: Record<string, unknown>
      createdAt: string
    }
  }
}

const DB_NAME = 'telos-offline'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null

export function getDB(): Promise<IDBPDatabase<OfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Items store
        if (!db.objectStoreNames.contains('items')) {
          const itemsStore = db.createObjectStore('items', { keyPath: 'id' })
          itemsStore.createIndex('by-cached-at', 'cachedAt')
        }

        // Highlights store
        if (!db.objectStoreNames.contains('highlights')) {
          const highlightsStore = db.createObjectStore('highlights', { keyPath: 'id' })
          highlightsStore.createIndex('by-item', 'item_id')
        }

        // Pending actions store (for offline sync)
        if (!db.objectStoreNames.contains('pendingActions')) {
          db.createObjectStore('pendingActions', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

// Item operations
export async function cacheItem(item: Item): Promise<void> {
  const db = await getDB()
  await db.put('items', {
    ...item,
    cachedAt: new Date().toISOString(),
  })
}

export async function getCachedItem(id: string): Promise<(Item & { cachedAt: string }) | undefined> {
  const db = await getDB()
  return db.get('items', id)
}

export async function getAllCachedItems(): Promise<(Item & { cachedAt: string })[]> {
  const db = await getDB()
  return db.getAll('items')
}

export async function removeCachedItem(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('items', id)
}

export async function isItemCached(id: string): Promise<boolean> {
  const db = await getDB()
  const item = await db.get('items', id)
  return !!item
}

// Highlight operations
export async function cacheHighlight(highlight: Highlight): Promise<void> {
  const db = await getDB()
  await db.put('highlights', {
    ...highlight,
    cachedAt: new Date().toISOString(),
  })
}

export async function getHighlightsForItem(itemId: string): Promise<Highlight[]> {
  const db = await getDB()
  return db.getAllFromIndex('highlights', 'by-item', itemId)
}

export async function removeCachedHighlight(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('highlights', id)
}

// Pending actions for offline sync
export async function addPendingAction(
  type: OfflineDB['pendingActions']['value']['type'],
  payload: Record<string, unknown>
): Promise<void> {
  const db = await getDB()
  await db.put('pendingActions', {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  })
}

export async function getPendingActions(): Promise<OfflineDB['pendingActions']['value'][]> {
  const db = await getDB()
  return db.getAll('pendingActions')
}

export async function removePendingAction(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('pendingActions', id)
}

export async function clearPendingActions(): Promise<void> {
  const db = await getDB()
  await db.clear('pendingActions')
}

// Storage management
export async function getCacheStats(): Promise<{
  itemCount: number
  highlightCount: number
  pendingActionsCount: number
  estimatedSize: number
}> {
  const db = await getDB()
  const items = await db.getAll('items')
  const highlights = await db.getAll('highlights')
  const pendingActions = await db.getAll('pendingActions')

  // Rough size estimation
  const estimatedSize = JSON.stringify(items).length +
                        JSON.stringify(highlights).length +
                        JSON.stringify(pendingActions).length

  return {
    itemCount: items.length,
    highlightCount: highlights.length,
    pendingActionsCount: pendingActions.length,
    estimatedSize,
  }
}

export async function clearAllCache(): Promise<void> {
  const db = await getDB()
  await Promise.all([
    db.clear('items'),
    db.clear('highlights'),
    db.clear('pendingActions'),
  ])
}
