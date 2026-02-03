'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/layout/sidebar'
import { Header, type FilterStatus, type FilterType } from '@/components/layout/header'
import { ItemCard } from '@/components/items/item-card'
import { AddItemDialog } from '@/components/items/add-item-dialog'
import { CommandPalette } from '@/components/command-palette'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Plus, Inbox } from 'lucide-react'
import { toast } from 'sonner'
import { CreateFolderDialog } from '@/components/dialogs/create-folder-dialog'
import { CreateTagDialog } from '@/components/dialogs/create-tag-dialog'
import { SettingsDialog } from '@/components/dialogs/settings-dialog'
import { MoveToFolderDialog } from '@/components/dialogs/move-to-folder-dialog'
import { AddTagsDialog } from '@/components/dialogs/add-tags-dialog'
import { ItemDetailDialog } from '@/components/items/item-detail-dialog'
import { ReaderDialog } from '@/components/reader/reader-dialog'
import { isItemCached, getAllCachedItems } from '@/lib/offline'
import { registerServiceWorker } from '@/lib/offline/service-worker'
import { CreateGroupDialog } from '@/components/social/create-group-dialog'
import { ShareToGroupDialog } from '@/components/social/share-to-group-dialog'
import type { Item, Folder, Tag, Group } from '@/lib/supabase/types'

interface DashboardProps {
  initialItems: Item[]
  initialFolders: Folder[]
  initialTags: Tag[]
  initialGroups?: (Group & { userRole: string })[]
  initialPendingInvitationsCount?: number
  userId: string
  userEmail?: string
  currentFolder?: Folder
  currentTag?: Tag
}

export function Dashboard({ initialItems, initialFolders, initialTags, initialGroups = [], initialPendingInvitationsCount = 0, userId, userEmail, currentFolder, currentTag }: DashboardProps) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [groups, setGroups] = useState<(Group & { userRole: string })[]>(initialGroups)
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(initialPendingInvitationsCount)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [createTagOpen, setCreateTagOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterTypes, setFilterTypes] = useState<FilterType[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [moveToFolderOpen, setMoveToFolderOpen] = useState(false)
  const [addTagsOpen, setAddTagsOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [itemTagsMap, setItemTagsMap] = useState<Record<string, string[]>>({})
  const [itemDetailOpen, setItemDetailOpen] = useState(false)
  const [viewingItemId, setViewingItemId] = useState<string | null>(null)
  const [readerOpen, setReaderOpen] = useState(false)
  const [readerItemId, setReaderItemId] = useState<string | null>(null)
  const [offlineCachedIds, setOfflineCachedIds] = useState<Set<string>>(new Set())
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [shareToGroupOpen, setShareToGroupOpen] = useState(false)
  const [shareItemId, setShareItemId] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  // Register service worker and load cached items
  useEffect(() => {
    registerServiceWorker()

    // Load offline cached item IDs
    getAllCachedItems().then((cachedItems) => {
      setOfflineCachedIds(new Set(cachedItems.map((item) => item.id)))
    })
  }, [])

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        setAddDialogOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Real-time subscription for instant item updates
  useEffect(() => {
    const channel = supabase
      .channel('items-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'items',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newItem = payload.new as Item
          // Only add if not already in the list (prevents duplicates from local adds)
          setItems((prev) => {
            if (prev.some((item) => item.id === newItem.id)) {
              return prev
            }
            return [newItem, ...prev]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleAddItem = async (data: { url?: string; title: string; content?: string; description?: string; type: 'link' | 'note' | 'pdf' }) => {
    let metadata: { title: string; description: string | null; thumbnail: string | null; contentType: string } = {
      title: data.title,
      description: null,
      thumbnail: null,
      contentType: data.type === 'note' ? 'note' : data.type === 'pdf' ? 'pdf' : 'link',
    }

    // Fetch metadata for links (not for PDFs or notes)
    if (data.url && data.type === 'link') {
      try {
        const response = await fetch(`/api/metadata?url=${encodeURIComponent(data.url)}`)
        if (response.ok) {
          metadata = await response.json()
        }
      } catch {
        // Use defaults
      }
    }

    // Use user-provided description if available, otherwise fall back to metadata
    const finalDescription = data.description || metadata.description

    const { data: newItem, error } = await supabase
      .from('items')
      .insert({
        user_id: userId,
        type: data.type,
        url: data.url || null,
        title: data.title || metadata.title,
        description: finalDescription,
        thumbnail: metadata.thumbnail,
        content: data.content || null,
        content_type: metadata.contentType,
        status: 'unread',
      })
      .select()
      .single()

    if (error) {
      toast.error('Failed to add item')
      return
    }

    if (newItem) {
      setItems((prev) => [newItem as Item, ...prev])
      toast.success('Item added!')
    }
  }

  const handleMarkRead = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return

    const newStatus = item.status === 'read' ? 'unread' : 'read'
    const { error } = await supabase
      .from('items')
      .update({ status: newStatus })
      .eq('id', id)

    if (!error) {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i))
      )
    }
  }

  const handleArchive = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return

    const previousStatus = item.status

    // Optimistically update UI
    setItems((prev) => prev.filter((i) => i.id !== id))

    const { error } = await supabase
      .from('items')
      .update({ status: 'archived' })
      .eq('id', id)

    if (error) {
      // Restore on error
      setItems((prev) => [item, ...prev])
      toast.error('Failed to archive item')
      return
    }

    toast.success('Item archived', {
      action: {
        label: 'Undo',
        onClick: async () => {
          await supabase.from('items').update({ status: previousStatus }).eq('id', id)
          setItems((prev) => [{ ...item, status: previousStatus }, ...prev])
        },
      },
    })
  }

  const handleDelete = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return

    // Optimistically update UI
    setItems((prev) => prev.filter((i) => i.id !== id))

    const { error } = await supabase.from('items').delete().eq('id', id)

    if (error) {
      // Restore on error
      setItems((prev) => [item, ...prev])
      toast.error('Failed to delete item')
      return
    }

    toast.success('Item deleted', {
      action: {
        label: 'Undo',
        onClick: async () => {
          // Re-insert the item
          const { data: restored } = await supabase
            .from('items')
            .insert({
              user_id: item.user_id,
              type: item.type,
              url: item.url,
              title: item.title,
              description: item.description,
              thumbnail: item.thumbnail,
              content: item.content,
              folder_id: item.folder_id,
              status: item.status,
              content_type: item.content_type,
            })
            .select()
            .single()

          if (restored) {
            setItems((prev) => [restored as Item, ...prev])
            toast.success('Item restored')
          }
        },
      },
    })
  }

  const handleCreateFolder = async (name: string) => {
    const { data: newFolder, error } = await supabase
      .from('folders')
      .insert({ user_id: userId, name })
      .select()
      .single()

    if (error) {
      toast.error('Failed to create folder')
      return
    }

    if (newFolder) {
      setFolders((prev) => [...prev, newFolder as Folder])
      toast.success(`Folder "${name}" created`)
    }
  }

  const handleCreateTag = async (name: string, color: string) => {
    const { data: newTag, error } = await supabase
      .from('tags')
      .insert({ user_id: userId, name, color })
      .select()
      .single()

    if (error) {
      toast.error('Failed to create tag')
      return
    }

    if (newTag) {
      setTags((prev) => [...prev, newTag as Tag])
      toast.success(`Tag "${name}" created`)
    }
  }

  const handleMoveToFolder = async (itemId: string) => {
    setSelectedItemId(itemId)
    setMoveToFolderOpen(true)
  }

  const handleConfirmMoveFolder = async (folderId: string | null) => {
    if (!selectedItemId) return

    const { error } = await supabase
      .from('items')
      .update({ folder_id: folderId })
      .eq('id', selectedItemId)

    if (error) {
      toast.error('Failed to move item')
      return
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === selectedItemId ? { ...item, folder_id: folderId } : item
      )
    )
    const folderName = folderId ? folders.find((f) => f.id === folderId)?.name : 'No folder'
    toast.success(`Moved to ${folderName}`)
  }

  const handleAddTag = async (itemId: string) => {
    setSelectedItemId(itemId)
    // Fetch current tags for this item
    const { data: itemTags } = await supabase
      .from('item_tags')
      .select('tag_id')
      .eq('item_id', itemId)

    const tagIds = itemTags?.map((it) => it.tag_id) || []
    setItemTagsMap((prev) => ({ ...prev, [itemId]: tagIds }))
    setAddTagsOpen(true)
  }

  const handleConfirmAddTags = async (tagIds: string[]) => {
    if (!selectedItemId) return

    // Get current tags
    const currentTagIds = itemTagsMap[selectedItemId] || []

    // Find tags to add and remove
    const toAdd = tagIds.filter((id) => !currentTagIds.includes(id))
    const toRemove = currentTagIds.filter((id) => !tagIds.includes(id))

    // Remove tags
    if (toRemove.length > 0) {
      await supabase
        .from('item_tags')
        .delete()
        .eq('item_id', selectedItemId)
        .in('tag_id', toRemove)
    }

    // Add new tags
    if (toAdd.length > 0) {
      await supabase
        .from('item_tags')
        .insert(toAdd.map((tagId) => ({ item_id: selectedItemId, tag_id: tagId })))
    }

    // Update local cache
    setItemTagsMap((prev) => ({ ...prev, [selectedItemId]: tagIds }))
    toast.success('Tags updated')
  }

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    // In a real app, you'd filter items or make an API call
  }, [])

  const handleViewDetails = (itemId: string) => {
    setViewingItemId(itemId)
    setItemDetailOpen(true)
  }

  const handleOpenReader = (itemId: string) => {
    setReaderItemId(itemId)
    setReaderOpen(true)
  }

  const handleReaderItemUpdate = (updatedItem: Item) => {
    // Update item in local state
    setItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    )
    // Mark as cached
    setOfflineCachedIds((prev) => new Set([...prev, updatedItem.id]))
  }

  const handleCreateGroup = async (name: string, description: string) => {
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      })

      if (res.ok) {
        const data = await res.json()
        setGroups((prev) => [data.group, ...prev])
        toast.success(`Group "${name}" created`)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create group')
      }
    } catch {
      toast.error('Failed to create group')
    }
  }

  const handleShareToGroup = (itemId: string) => {
    setShareItemId(itemId)
    setShareToGroupOpen(true)
  }

  const handleConfirmShareToGroups = async (itemId: string, groupIds: string[], note: string) => {
    const results = await Promise.all(
      groupIds.map(async (groupId) => {
        try {
          const res = await fetch(`/api/groups/${groupId}/shared`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, note })
          })
          return res.ok
        } catch {
          return false
        }
      })
    )

    const successCount = results.filter(Boolean).length
    if (successCount > 0) {
      toast.success(`Shared to ${successCount} group${successCount !== 1 ? 's' : ''}`)
    } else {
      toast.error('Failed to share item')
    }
  }

  // Fetch groups on mount if not provided
  useEffect(() => {
    if (initialGroups.length === 0) {
      fetch('/api/groups')
        .then((res) => res.ok ? res.json() : { groups: [] })
        .then((data) => setGroups(data.groups || []))
        .catch(() => {})

      fetch('/api/invitations')
        .then((res) => res.ok ? res.json() : { invitations: [] })
        .then((data) => setPendingInvitationsCount(data.invitations?.length || 0))
        .catch(() => {})
    }
  }, [initialGroups.length])

  const filteredItems = items
    .filter((item) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!item.title.toLowerCase().includes(query) &&
            !item.description?.toLowerCase().includes(query) &&
            !item.content?.toLowerCase().includes(query)) {
          return false
        }
      }

      // Status filter
      if (filterStatus !== 'all' && item.status !== filterStatus) {
        return false
      }

      // Type filter (multi-select)
      if (filterTypes.length > 0 && !filterTypes.includes(item.content_type as FilterType)) {
        return false
      }

      return true
    })
    .sort((a, b) => {
      // Unread items first, read items last
      if (a.status === 'unread' && b.status !== 'unread') return -1
      if (a.status !== 'unread' && b.status === 'unread') return 1
      return 0 // Maintain relative order otherwise
    })

  // Ref for virtualized scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Calculate columns based on viewport for grid virtualization
  const getColumnCount = useCallback(() => {
    if (typeof window === 'undefined') return 2
    const width = window.innerWidth
    if (width >= 1280) return 4 // xl
    if (width >= 1024) return 3 // lg
    if (width >= 640) return 2  // sm
    return 1 // mobile
  }, [])

  const [columnCount, setColumnCount] = useState(2)

  useEffect(() => {
    const updateColumns = () => setColumnCount(getColumnCount())
    updateColumns()
    window.addEventListener('resize', updateColumns)
    return () => window.removeEventListener('resize', updateColumns)
  }, [getColumnCount])

  // Grid virtualization - group items into rows
  const gridRows = useMemo(() => {
    const rows: Item[][] = []
    for (let i = 0; i < filteredItems.length; i += columnCount) {
      rows.push(filteredItems.slice(i, i + columnCount))
    }
    return rows
  }, [filteredItems, columnCount])

  // Grid virtualizer
  const gridVirtualizer = useVirtualizer({
    count: gridRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 400, // Estimated row height for grid cards
    overscan: 3,
  })

  // List virtualizer
  const listVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 72, // Estimated height for list items
    overscan: 5,
  })

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          folders={folders}
          tags={tags}
          groups={groups}
          pendingInvitationsCount={pendingInvitationsCount}
          userEmail={userEmail}
          onSignOut={handleSignOut}
          onCreateFolder={() => setCreateFolderOpen(true)}
          onCreateTag={() => setCreateTagOpen(true)}
          onCreateGroup={() => setCreateGroupOpen(true)}
          onAddItem={() => setAddDialogOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar
            folders={folders}
            tags={tags}
            groups={groups}
            pendingInvitationsCount={pendingInvitationsCount}
            userEmail={userEmail}
            onSignOut={handleSignOut}
            onCreateFolder={() => setCreateFolderOpen(true)}
            onCreateTag={() => setCreateTagOpen(true)}
            onCreateGroup={() => setCreateGroupOpen(true)}
            onAddItem={() => setAddDialogOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={currentFolder ? currentFolder.name : currentTag ? currentTag.name : "All Items"}
          itemCount={filteredItems.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSearch={handleSearch}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onToggleSidebar={() => setSidebarOpen(true)}
          filterStatus={filterStatus}
          filterTypes={filterTypes}
          onFilterStatusChange={setFilterStatus}
          onFilterTypesChange={setFilterTypes}
        />

        <main ref={scrollContainerRef} className="flex-1 overflow-auto p-4 md:p-6">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold">No items yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first link or note to get started
              </p>
              <Button
                className="mt-4 gap-2"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add your first item
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div
              style={{
                height: `${gridVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {gridVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = gridRows[virtualRow.index]
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {row.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          viewMode="grid"
                          isOfflineCached={offlineCachedIds.has(item.id)}
                          onMarkRead={handleMarkRead}
                          onArchive={handleArchive}
                          onDelete={handleDelete}
                          onMoveToFolder={handleMoveToFolder}
                          onAddTag={handleAddTag}
                          onViewDetails={handleViewDetails}
                          onOpenReader={handleOpenReader}
                          onShareToGroup={groups.length > 0 ? handleShareToGroup : undefined}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div
              style={{
                height: `${listVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {listVirtualizer.getVirtualItems().map((virtualItem) => {
                const item = filteredItems[virtualItem.index]
                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <div className="pb-2">
                      <ItemCard
                        item={item}
                        viewMode="list"
                        isOfflineCached={offlineCachedIds.has(item.id)}
                        onMarkRead={handleMarkRead}
                        onArchive={handleArchive}
                        onDelete={handleDelete}
                        onMoveToFolder={handleMoveToFolder}
                        onAddTag={handleAddTag}
                        onViewDetails={handleViewDetails}
                        onOpenReader={handleOpenReader}
                        onShareToGroup={groups.length > 0 ? handleShareToGroup : undefined}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>

        {/* Floating Add Button */}
        <Button
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg glow md:hidden"
          onClick={() => setAddDialogOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Dialogs */}
      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAddItem={handleAddItem}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onAddItem={() => setAddDialogOpen(true)}
        items={items}
        folders={folders}
        tags={tags}
      />

      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        onCreateFolder={handleCreateFolder}
      />

      <CreateTagDialog
        open={createTagOpen}
        onOpenChange={setCreateTagOpen}
        onCreateTag={handleCreateTag}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <MoveToFolderDialog
        open={moveToFolderOpen}
        onOpenChange={setMoveToFolderOpen}
        folders={folders}
        currentFolderId={selectedItemId ? items.find((i) => i.id === selectedItemId)?.folder_id || null : null}
        onMove={handleConfirmMoveFolder}
      />

      <AddTagsDialog
        open={addTagsOpen}
        onOpenChange={setAddTagsOpen}
        tags={tags}
        currentTagIds={selectedItemId ? itemTagsMap[selectedItemId] || [] : []}
        onSave={handleConfirmAddTags}
      />

      <ItemDetailDialog
        item={viewingItemId ? items.find((i) => i.id === viewingItemId) || null : null}
        tags={viewingItemId ? tags.filter((t) => itemTagsMap[viewingItemId]?.includes(t.id)) : []}
        open={itemDetailOpen}
        isOfflineCached={viewingItemId ? offlineCachedIds.has(viewingItemId) : false}
        onOpenChange={setItemDetailOpen}
        onOpenReader={() => {
          if (viewingItemId) {
            setItemDetailOpen(false)
            handleOpenReader(viewingItemId)
          }
        }}
      />

      <ReaderDialog
        item={readerItemId ? items.find((i) => i.id === readerItemId) || null : null}
        open={readerOpen}
        onOpenChange={setReaderOpen}
        onItemUpdate={handleReaderItemUpdate}
      />

      <CreateGroupDialog
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onCreateGroup={handleCreateGroup}
      />

      <ShareToGroupDialog
        open={shareToGroupOpen}
        onOpenChange={setShareToGroupOpen}
        item={shareItemId ? items.find((i) => i.id === shareItemId) || null : null}
        groups={groups}
        onShare={handleConfirmShareToGroups}
      />
    </div>
  )
}
