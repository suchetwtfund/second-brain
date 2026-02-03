'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Command, LayoutGrid, List, SlidersHorizontal, Menu, Check, Square, X } from 'lucide-react'

export type FilterStatus = 'all' | 'unread' | 'read'
export type FilterType = 'video' | 'article' | 'substack' | 'tweet' | 'link' | 'note' | 'pdf' | 'spotify'

interface HeaderProps {
  title: string
  itemCount?: number
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onSearch: (query: string) => void
  onOpenCommandPalette: () => void
  onToggleSidebar: () => void
  filterStatus: FilterStatus
  filterTypes: FilterType[]
  onFilterStatusChange: (status: FilterStatus) => void
  onFilterTypesChange: (types: FilterType[]) => void
}

export function Header({
  title,
  itemCount,
  viewMode,
  onViewModeChange,
  onSearch,
  onOpenCommandPalette,
  onToggleSidebar,
  filterStatus,
  filterTypes,
  onFilterStatusChange,
  onFilterTypesChange,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (mobileSearchOpen && mobileSearchRef.current) {
      mobileSearchRef.current.focus()
    }
  }, [mobileSearchOpen])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)

    // Debounce search to avoid excessive filtering on mobile
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      onSearch(value)
    }, 200)
  }, [onSearch])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
  }

  const toggleType = (type: FilterType) => {
    if (filterTypes.includes(type)) {
      onFilterTypesChange(filterTypes.filter(t => t !== type))
    } else {
      onFilterTypesChange([...filterTypes, type])
    }
  }

  const clearAllFilters = () => {
    onFilterStatusChange('all')
    onFilterTypesChange([])
  }

  const closeMobileSearch = () => {
    setMobileSearchOpen(false)
    setSearchQuery('')
    onSearch('')
  }

  return (
    <header className="relative flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm">
      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <div className="absolute inset-0 z-50 flex items-center gap-2 bg-background px-4 sm:hidden">
          <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <Input
            ref={mobileSearchRef}
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 bg-transparent border-none focus-visible:ring-0 px-0"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={closeMobileSearch}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}
      <div className="flex items-center gap-4">
        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onToggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Title */}
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          {itemCount !== undefined && (
            <p className="text-xs text-muted-foreground">{itemCount} items</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-64 bg-secondary/50 pl-9 pr-12"
          />
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            <Command className="h-3 w-3" />K
          </button>
        </form>

        {/* Mobile search button */}
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={() => setMobileSearchOpen(true)}
        >
          <Search className="h-5 w-5" />
        </Button>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-border bg-secondary/30">
          <Button
            variant="ghost"
            size="icon"
            className={viewMode === 'grid' ? 'bg-secondary' : ''}
            onClick={() => onViewModeChange('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={viewMode === 'list' ? 'bg-secondary' : ''}
            onClick={() => onViewModeChange('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={(filterStatus !== 'all' || filterTypes.length > 0) ? 'text-primary' : ''}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={clearAllFilters}
              className={filterStatus === 'all' && filterTypes.length === 0 ? 'bg-secondary' : ''}
            >
              All items
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onFilterStatusChange('all')} className="flex justify-between">
              All Status
              {filterStatus === 'all' ? <Check className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterStatusChange('unread')} className="flex justify-between">
              Unread only
              {filterStatus === 'unread' ? <Check className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterStatusChange('read')} className="flex justify-between">
              Read only
              {filterStatus === 'read' ? <Check className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onFilterTypesChange([])} className="flex justify-between">
              All Types
              {filterTypes.length === 0 ? <Check className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleType('video')} className="flex justify-between">
              Videos
              {filterTypes.includes('video') ? <Check className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleType('article')} className="flex justify-between">
              Articles
              {filterTypes.includes('article') ? <Check className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleType('substack')} className="flex justify-between">
              Substack
              {filterTypes.includes('substack') ? <Check className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleType('tweet')} className="flex justify-between">
              Tweets
              {filterTypes.includes('tweet') ? <Check className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleType('link')} className="flex justify-between">
              Links
              {filterTypes.includes('link') ? <Check className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleType('note')} className="flex justify-between">
              Notes
              {filterTypes.includes('note') ? <Check className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleType('pdf')} className="flex justify-between">
              PDFs
              {filterTypes.includes('pdf') ? <Check className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleType('spotify')} className="flex justify-between">
              Spotify
              {filterTypes.includes('spotify') ? <Check className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
