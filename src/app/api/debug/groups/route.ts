import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/debug/groups - Debug endpoint to check groups and memberships
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all groups (no filter)
    const { data: allGroups, error: groupsError } = await supabase
      .from('groups')
      .select('*')

    // Get all group_members
    const { data: allMembers, error: membersError } = await supabase
      .from('group_members')
      .select('*')

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Get groups where user is owner
    const { data: ownedGroups, error: ownedError } = await supabase
      .from('groups')
      .select('*')
      .eq('owner_id', user.id)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      profile,
      profileError: profileError?.message,
      allGroups,
      groupsError: groupsError?.message,
      allMembers,
      membersError: membersError?.message,
      ownedGroups,
      ownedError: ownedError?.message
    })
  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
