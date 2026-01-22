'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Minus,
  Plus,
  Moon,
  Sun,
  Clock,
  BookOpen,
} from 'lucide-react'
import type { Item } from '@/lib/supabase/types'

interface ReaderViewProps {
  item: Item
  className?: string
}

type FontSize = 'sm' | 'base' | 'lg' | 'xl'

const fontSizeClasses: Record<FontSize, string> = {
  sm: 'text-sm leading-relaxed',
  base: 'text-base leading-relaxed',
  lg: 'text-lg leading-loose',
  xl: 'text-xl leading-loose',
}

export function ReaderView({ item, className }: ReaderViewProps) {
  const [fontSize, setFontSize] = useState<FontSize>('base')
  const [darkMode, setDarkMode] = useState(false)

  // Load preferences from localStorage
  useEffect(() => {
    const savedFontSize = localStorage.getItem('reader-font-size') as FontSize
    const savedDarkMode = localStorage.getItem('reader-dark-mode')

    if (savedFontSize && fontSizeClasses[savedFontSize]) {
      setFontSize(savedFontSize)
    }
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true')
    }
  }, [])

  const changeFontSize = (direction: 'increase' | 'decrease') => {
    const sizes: FontSize[] = ['sm', 'base', 'lg', 'xl']
    const currentIndex = sizes.indexOf(fontSize)
    let newIndex = direction === 'increase' ? currentIndex + 1 : currentIndex - 1
    newIndex = Math.max(0, Math.min(sizes.length - 1, newIndex))
    const newSize = sizes[newIndex]
    setFontSize(newSize)
    localStorage.setItem('reader-font-size', newSize)
  }

  const toggleDarkMode = () => {
    const newValue = !darkMode
    setDarkMode(newValue)
    localStorage.setItem('reader-dark-mode', String(newValue))
  }

  if (!item.content) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <h3 className="mb-2 text-lg font-medium">No content available</h3>
        <p className="text-sm text-muted-foreground">
          Click &quot;Save Offline&quot; to extract the article content.
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative min-h-full transition-colors',
        darkMode ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-zinc-900',
        className
      )}
    >
      {/* Reader controls */}
      <div
        className={cn(
          'sticky top-0 z-10 flex items-center justify-between border-b px-3 py-2 md:px-4',
          darkMode ? 'border-zinc-700 bg-zinc-900/95' : 'border-zinc-200 bg-white/95'
        )}
      >
        <div className="flex items-center gap-2">
          {item.reading_time_minutes && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {item.reading_time_minutes} min
            </span>
          )}
          {item.word_count && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {item.word_count.toLocaleString()} words
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 md:gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => changeFontSize('decrease')}
            disabled={fontSize === 'sm'}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-[2.5rem] text-center text-xs md:min-w-[3rem]">
            {fontSize.toUpperCase()}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => changeFontSize('increase')}
            disabled={fontSize === 'xl'}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 h-8 w-8 md:ml-2"
            onClick={toggleDarkMode}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Article content */}
      <article className="mx-auto max-w-2xl px-4 py-6 md:px-6 md:py-8">
        <header className="mb-6 md:mb-8">
          <h1 className="mb-3 text-2xl font-bold leading-tight md:mb-4 md:text-3xl">
            {item.title}
          </h1>
          {item.description && (
            <p className={cn(
              'text-base md:text-lg',
              darkMode ? 'text-zinc-400' : 'text-zinc-600'
            )}>
              {item.description}
            </p>
          )}
        </header>

        <div
          className={cn(
            'prose max-w-none',
            darkMode && 'prose-invert',
            fontSizeClasses[fontSize],
            // Custom prose styling for reader mode
            '[&_p]:mb-4',
            '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4',
            '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3',
            '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2',
            '[&_ul]:my-4 [&_ul]:pl-6 [&_ul]:list-disc',
            '[&_ol]:my-4 [&_ol]:pl-6 [&_ol]:list-decimal',
            '[&_li]:mb-2',
            '[&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:italic',
            darkMode ? '[&_blockquote]:border-zinc-600' : '[&_blockquote]:border-zinc-300',
            '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-4',
            darkMode ? '[&_pre]:bg-zinc-800' : '[&_pre]:bg-zinc-100',
            '[&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm',
            darkMode ? '[&_code]:bg-zinc-800' : '[&_code]:bg-zinc-100',
            '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
            '[&_img]:my-4 [&_img]:rounded-lg [&_img]:mx-auto',
            '[&_figure]:my-6',
            '[&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:mt-2',
            darkMode ? '[&_figcaption]:text-zinc-500' : '[&_figcaption]:text-zinc-600',
          )}
          dangerouslySetInnerHTML={{ __html: item.content }}
        />
      </article>
    </div>
  )
}
