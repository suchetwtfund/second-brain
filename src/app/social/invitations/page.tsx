import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InvitationsPageClient } from './invitations-page-client'

export default async function InvitationsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's email from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single()

  let invitations: Array<{
    id: string
    group_id: string
    email: string
    invited_by: string
    status: string
    created_at: string
    expires_at: string
    group: { id: string; name: string; description: string | null }
    inviter: { email: string; display_name: string | null; avatar_url: string | null }
  }> = []

  if (profile) {
    const { data } = await supabase
      .from('group_invitations')
      .select(`
        *,
        group:group_id (
          id,
          name,
          description
        ),
        inviter:invited_by (
          email,
          display_name,
          avatar_url
        )
      `)
      .eq('email', profile.email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    invitations = data || []
  }

  // Fetch user's groups for sidebar
  const { data: userGroups } = await supabase
    .from('groups')
    .select(`
      *,
      group_members!inner (
        user_id,
        role
      )
    `)
    .eq('group_members.user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch folders and tags for navigation
  const [{ data: folders }, { data: tags }] = await Promise.all([
    supabase.from('folders').select('*').order('name'),
    supabase.from('tags').select('*').order('name'),
  ])

  const groupsWithRole = (userGroups || []).map(g => ({
    ...g,
    userRole: g.group_members[0]?.role || 'member',
    group_members: undefined
  }))

  // Cast invitations to the expected type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedInvitations = invitations as any[]

  return (
    <InvitationsPageClient
      invitations={typedInvitations}
      groups={groupsWithRole}
      folders={folders || []}
      tags={tags || []}
      userEmail={user.email || ''}
    />
  )
}
