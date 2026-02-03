import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/groups/[id]/members - Add member to group (by user ID)
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if requester is admin or owner
    const { data: membership, error: memberError } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can add members' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, role = 'member' } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be "admin" or "member"' }, { status: 400 })
    }

    // Check if user is already a member
    const { data: existing } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'User is already a member of this group' }, { status: 409 })
    }

    // Add the member
    const { data: member, error: insertError } = await supabase
      .from('group_members')
      .insert({
        group_id: groupId,
        user_id: userId,
        role
      })
      .select(`
        user_id,
        role,
        joined_at,
        profiles:user_id (
          id,
          email,
          display_name,
          avatar_url
        )
      `)
      .single()

    if (insertError) {
      console.error('Error adding member:', insertError)
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
    }

    return NextResponse.json({
      member: {
        ...(member.profiles as object),
        role: member.role,
        joined_at: member.joined_at
      }
    }, { status: 201 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/groups/[id]/members - Remove member from group
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userIdToRemove = searchParams.get('userId')

    if (!userIdToRemove) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Check requester's role
    const { data: membership, error: memberError } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    // Users can remove themselves, or admins/owners can remove others
    const isSelfRemoval = userIdToRemove === user.id
    const isAdminOrOwner = ['owner', 'admin'].includes(membership.role)

    if (!isSelfRemoval && !isAdminOrOwner) {
      return NextResponse.json({ error: 'You can only remove yourself or be an admin/owner' }, { status: 403 })
    }

    // Check if trying to remove the owner
    const { data: targetMembership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userIdToRemove)
      .single()

    if (targetMembership?.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove the group owner' }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userIdToRemove)

    if (deleteError) {
      console.error('Error removing member:', deleteError)
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
