import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/groups/[id]/shared - List shared items in group
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a member
    const { data: membership, error: memberError } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    // Get shared items with item details and sharer info
    const { data: sharedItems, error } = await supabase
      .from('shared_items')
      .select(`
        id,
        note,
        created_at,
        item:item_id (
          id,
          type,
          url,
          title,
          description,
          thumbnail,
          content,
          status,
          content_type,
          created_at,
          word_count,
          reading_time_minutes
        ),
        sharer:shared_by (
          id,
          email,
          display_name,
          avatar_url
        )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching shared items:', error)
      return NextResponse.json({ error: 'Failed to fetch shared items' }, { status: 500 })
    }

    return NextResponse.json({ sharedItems })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/groups/[id]/shared - Share item to group
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a member
    const { data: membership, error: memberError } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    const body = await request.json()
    const { itemId, note } = body

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    // Check if user owns the item
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, user_id, title')
      .eq('id', itemId)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (item.user_id !== user.id) {
      return NextResponse.json({ error: 'You can only share items you own' }, { status: 403 })
    }

    // Check if already shared
    const { data: existing } = await supabase
      .from('shared_items')
      .select('id')
      .eq('item_id', itemId)
      .eq('group_id', groupId)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Item is already shared to this group' }, { status: 409 })
    }

    // Share the item
    const { data: sharedItem, error: shareError } = await supabase
      .from('shared_items')
      .insert({
        item_id: itemId,
        group_id: groupId,
        shared_by: user.id,
        note: note?.trim() || null
      })
      .select(`
        id,
        note,
        created_at,
        item:item_id (
          id,
          type,
          url,
          title,
          description,
          thumbnail,
          content_type
        ),
        sharer:shared_by (
          id,
          email,
          display_name,
          avatar_url
        )
      `)
      .single()

    if (shareError) {
      console.error('Error sharing item:', shareError)
      return NextResponse.json({ error: 'Failed to share item' }, { status: 500 })
    }

    return NextResponse.json({ sharedItem }, { status: 201 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
