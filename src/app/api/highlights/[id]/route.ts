import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// Create admin client for Bearer token auth (used by extension)
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Helper to get authenticated user from either cookies or Bearer token
async function getAuthenticatedUser(request: NextRequest): Promise<{
  user: { id: string };
  supabase: SupabaseClient;
} | null> {
  const authHeader = request.headers.get('authorization')

  // Try Bearer token first (used by extension)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (!error && user) {
      return { user, supabase: supabaseAdmin }
    }
  }

  // Fall back to cookie-based auth (used by web app)
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!error && user) {
    return { user, supabase }
  }

  return null
}

// PATCH - Update highlight (color, note)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)

    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user, supabase } = auth
    const { id } = await params
    const body = await request.json()
    const { color, note } = body

    // Build update object with only provided fields
    const updateData: { color?: string; note?: string } = {}
    if (color !== undefined) updateData.color = color
    if (note !== undefined) updateData.note = note

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data: highlight, error } = await supabase
      .from('highlights')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Update highlight error:', error)
      return NextResponse.json(
        { error: 'Failed to update highlight' },
        { status: 500 }
      )
    }

    if (!highlight) {
      return NextResponse.json(
        { error: 'Highlight not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, highlight })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove highlight
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)

    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { user, supabase } = auth
    const { id } = await params

    const { error } = await supabase
      .from('highlights')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Delete highlight error:', error)
      return NextResponse.json(
        { error: 'Failed to delete highlight' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
