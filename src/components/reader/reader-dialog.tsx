'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import {
  X,
  ExternalLink,
  Download,
  Loader2,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { ReaderView } from './reader-view'
import { OfflineBadge } from '@/components/ui/offline-badge'
import { saveForOffline, isOnline } from '@/lib/offline/sync'
import { isItemCached, getCachedItem } from '@/lib/offline/db'
import type { Item } from '@/lib/supabase/types'

interface ReaderDialogProps {
  item: Item | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onItemUpdate?: (item: Item) => void
}

export function ReaderDialog({ item, open, onOpenChange, onItemUpdate }: ReaderDialogProps) {
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [currentItem, setCurrentItem] = useState<Item | null>(item)
  const [isCached, setIsCached] = useState(false)
  const [online, setOnline] = useState(true)

  // Sync item prop changes
  useEffect(() => {
    setCurrentItem(item)
  }, [item])

  // Check cache status and online status
  useEffect(() => {
    if (item?.id) {
      isItemCached(item.id).then(setIsCached)
    }
    setOnline(isOnline())

    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [item?.id])

  // Load from cache when offline
  useEffect(() => {
    async function loadFromCache() {
      if (!online && item?.id && !currentItem?.content) {
        setLoading(true)
        const cachedItem = await getCachedItem(item.id)
        if (cachedItem) {
          setCurrentItem(cachedItem)
        }
        setLoading(false)
      }
    }
    loadFromCache()
  }, [online, item?.id, currentItem?.content])

  const handleSaveOffline = async () => {
    if (!item?.id) return

    setExtracting(true)
    const { item: updatedItem, error } = await saveForOffline(item.id)
    if (updatedItem) {
      setCurrentItem(updatedItem)
      setIsCached(true)
      onItemUpdate?.(updatedItem)
      toast.success('Article saved for offline reading')
    } else {
      toast.error(error || 'Failed to extract article content')
    }
    setExtracting(false)
  }

  const handleOpenExternal = () => {
    if (currentItem?.url) {
      window.open(currentItem.url, '_blank')
    }
  }

  if (!currentItem) return null

  const needsExtraction = !currentItem.content && !currentItem.content_extracted_at

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] max-h-[100dvh] w-full max-w-4xl overflow-hidden p-0 md:h-[95vh] md:max-h-[95vh]">
        {/* Header */}
        <div className="flex flex-col gap-2 border-b px-3 py-2 md:flex-row md:items-center md:justify-between md:px-4 md:py-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 md:hidden"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <h2 className="truncate text-base font-semibold md:text-lg">
              {currentItem.title}
            </h2>
            <div className="hidden items-center gap-2 md:flex">
              {isCached && <OfflineBadge />}
              {!online && (
                <span className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-500">
                  <WifiOff className="h-3 w-3" />
                  Offline
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile: Show badges */}
            <div className="flex items-center gap-2 md:hidden">
              {isCached && <OfflineBadge showText={false} />}
              {!online && (
                <WifiOff className="h-4 w-4 text-yellow-500" />
              )}
            </div>

            {needsExtraction && online && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSaveOffline}
                disabled={extracting}
                className="h-8 text-xs md:h-9 md:text-sm"
              >
                {extracting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin md:mr-2 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Extracting...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <Download className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Save Offline</span>
                    <span className="sm:hidden">Save</span>
                  </>
                )}
              </Button>
            )}
            {!isCached && currentItem.content && online && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSaveOffline}
                disabled={extracting}
                className="h-8 text-xs md:h-9 md:text-sm"
              >
                {extracting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin md:h-4 md:w-4" />
                ) : (
                  <>
                    <Download className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Save Offline</span>
                    <span className="sm:hidden">Save</span>
                  </>
                )}
              </Button>
            )}
            {currentItem.url && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleOpenExternal}
                className="h-8 text-xs md:h-9 md:text-sm"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
                Open
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="hidden h-8 w-8 md:flex"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ReaderView item={currentItem} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
