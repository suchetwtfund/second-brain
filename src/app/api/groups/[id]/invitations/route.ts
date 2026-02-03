import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/groups/[id]/invitations - Send invitation by email
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
      return NextResponse.json({ error: 'Only owners and admins can invite members' }, { status: 403 })
    }

    const body = await request.json()
    const { email } = body

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Check if user with this email is already a member
    const { data: existingMember } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .single()

    if (existingMember) {
      const { data: isMember } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('user_id', existingMember.id)
        .single()

      if (isMember) {
        return NextResponse.json({ error: 'User is already a member of this group' }, { status: 409 })
      }
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from('group_invitations')
      .select('id, status')
      .eq('group_id', groupId)
      .eq('email', normalizedEmail)
      .single()

    if (existingInvite) {
      if (existingInvite.status === 'pending') {
        return NextResponse.json({ error: 'An invitation has already been sent to this email' }, { status: 409 })
      }
      // If declined, allow re-inviting by deleting old invitation
      await supabase
        .from('group_invitations')
        .delete()
        .eq('id', existingInvite.id)
    }

    // Create invitation
    const { data: invitation, error: insertError } = await supabase
      .from('group_invitations')
      .insert({
        group_id: groupId,
        email: normalizedEmail,
        invited_by: user.id
      })
      .select(`
        *,
        groups:group_id (
          name
        )
      `)
      .single()

    if (insertError) {
      console.error('Error creating invitation:', insertError)
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
    }

    return NextResponse.json({ invitation }, { status: 201 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/groups/[id]/invitations - List pending invitations for a group
export async function GET(request: NextRequest, context: RouteContext) {
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
      return NextResponse.json({ error: 'Only owners and admins can view invitations' }, { status: 403 })
    }

    const { data: invitations, error } = await supabase
      .from('group_invitations')
      .select(`
        *,
        inviter:invited_by (
          email,
          display_name
        )
      `)
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching invitations:', error)
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
    }

    return NextResponse.json({ invitations })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
