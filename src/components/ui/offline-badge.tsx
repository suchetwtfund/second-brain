'use client'

import { cn } from '@/lib/utils'
import { Download } from 'lucide-react'

interface OfflineBadgeProps {
  className?: string
  showText?: boolean
}

export function OfflineBadge({ className, showText = true }: OfflineBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-500',
        className
      )}
      title="Available offline"
    >
      <Download className="h-3 w-3" />
      {showText && <span>Offline</span>}
    </span>
  )
}
