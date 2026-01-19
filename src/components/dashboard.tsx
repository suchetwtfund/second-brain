'use client'

import { useState, useEffect, useCallback } from 'react'
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
import type { Item, Folder, Tag } from '@/lib/supabase/types'

interface DashboardProps {
  initialItems: Item[]
  initialFolders: Folder[]
  initialTags: Tag[]
  userId: string
  userEmail?: string
  currentFolder?: Folder
  currentTag?: Tag
}

export function Dashboard({ initialItems, initialFolders, initialTags, userId, userEmail, currentFolder, currentTag }: DashboardProps) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [tags, setTags] = useState<Tag[]>(initialTags)
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

  const router = useRouter()
  const supabase = createClient()

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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          folders={folders}
          tags={tags}
          userEmail={userEmail}
          onSignOut={handleSignOut}
          onCreateFolder={() => setCreateFolderOpen(true)}
          onCreateTag={() => setCreateTagOpen(true)}
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
            userEmail={userEmail}
            onSignOut={handleSignOut}
            onCreateFolder={() => setCreateFolderOpen(true)}
            onCreateTag={() => setCreateTagOpen(true)}
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

        <main className="flex-1 overflow-auto p-4 md:p-6">
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  viewMode="grid"
                  onMarkRead={handleMarkRead}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onMoveToFolder={handleMoveToFolder}
                  onAddTag={handleAddTag}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  viewMode="list"
                  onMarkRead={handleMarkRead}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onMoveToFolder={handleMoveToFolder}
                  onAddTag={handleAddTag}
                  onViewDetails={handleViewDetails}
                />
              ))}
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
        onOpenChange={setItemDetailOpen}
      />
    </div>
  )
}
