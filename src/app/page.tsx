import { createClient } from '@/lib/supabase/server'
import { DashboardWrapper } from '@/components/dashboard-wrapper'

export default async function Home() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null // Middleware will redirect
  }

  // Fetch user's data
  const [{ data: items }, { data: folders }, { data: tags }, { data: userGroups }] = await Promise.all([
    supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('folders')
      .select('*')
      .order('name'),
    supabase
      .from('tags')
      .select('*')
      .order('name'),
    supabase
      .from('groups')
      .select(`
        *,
        group_members!inner (
          user_id,
          role
        )
      `)
      .eq('group_members.user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  // Get pending invitations count
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single()

  let pendingInvitationsCount = 0
  if (profile) {
    const { count } = await supabase
      .from('group_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('email', profile.email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())

    pendingInvitationsCount = count || 0
  }

  const groupsWithRole = (userGroups || []).map(g => ({
    ...g,
    userRole: g.group_members[0]?.role || 'member',
    group_members: undefined
  }))

  return (
    <DashboardWrapper
      initialItems={items || []}
      initialFolders={folders || []}
      initialTags={tags || []}
      initialGroups={groupsWithRole}
      initialPendingInvitationsCount={pendingInvitationsCount}
      userId={user.id}
      userEmail={user.email || ''}
    />
  )
}
