'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Profile } from '@/lib/supabase/types'

interface MemberAvatarProps {
  member: Profile
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
}

const sizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base'
}

export function MemberAvatar({ member, size = 'md', showTooltip = true }: MemberAvatarProps) {
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email.slice(0, 2).toUpperCase()
  }

  const avatar = (
    <Avatar className={sizeClasses[size]}>
      <AvatarImage src={member.avatar_url || undefined} />
      <AvatarFallback>
        {getInitials(member.display_name, member.email)}
      </AvatarFallback>
    </Avatar>
  )

  if (!showTooltip) {
    return avatar
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {avatar}
        </TooltipTrigger>
        <TooltipContent>
          <p>{member.display_name || member.email}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface MemberAvatarStackProps {
  members: Profile[]
  max?: number
  size?: 'sm' | 'md' | 'lg'
}

export function MemberAvatarStack({ members, max = 4, size = 'sm' }: MemberAvatarStackProps) {
  const visible = members.slice(0, max)
  const remaining = members.length - max

  return (
    <div className="flex -space-x-2">
      {visible.map(member => (
        <MemberAvatar key={member.id} member={member} size={size} />
      ))}
      {remaining > 0 && (
        <div className={`${sizeClasses[size]} rounded-full bg-muted flex items-center justify-center border-2 border-background`}>
          +{remaining}
        </div>
      )}
    </div>
  )
}
