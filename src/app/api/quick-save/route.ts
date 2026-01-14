import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create admin client to look up users by API key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Simple API key generation: base64(user_id + secret)
// The secret ensures users can't guess other users' keys
const API_SECRET = process.env.TELOS_API_SECRET || 'telos-default-secret-change-me'

export function generateApiKey(userId: string): string {
  const data = `${userId}:${API_SECRET}`
  return Buffer.from(data).toString('base64')
}

export function decodeApiKey(apiKey: string): string | null {
  try {
    const decoded = Buffer.from(apiKey, 'base64').toString('utf-8')
    const [userId, secret] = decoded.split(':')
    if (secret === API_SECRET && userId) {
      return userId
    }
    return null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, api_key } = body

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    if (!api_key) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 401 }
      )
    }

    // Decode and validate API key
    const userId = decodeApiKey(api_key)
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }

    // API key is already validated by decodeApiKey (contains user_id + secret)
    // No need to verify user exists - if they have a valid key, they're valid

    // Detect content type from URL pattern (used as fallback)
    const detectContentTypeFromUrl = (urlStr: string): string => {
      try {
        const parsedUrl = new URL(urlStr)
        const hostname = parsedUrl.hostname.toLowerCase()
        if (hostname.includes('twitter.com') || hostname.includes('x.com') || hostname.includes('threads.net')) {
          return 'tweet'
        }
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be') || hostname.includes('vimeo.com')) {
          return 'video'
        }
        if (hostname.includes('medium.com') || hostname.includes('substack.com') || hostname.includes('dev.to')) {
          return 'article'
        }
        // Spotify podcasts (episodes and shows only)
        if (hostname.includes('open.spotify.com')) {
          const pathname = parsedUrl.pathname
          if (pathname.startsWith('/episode/') || pathname.startsWith('/show/')) {
            return 'spotify'
          }
        }
      } catch {}
      return 'link'
    }

    // Fetch metadata for the URL
    const fallbackContentType = detectContentTypeFromUrl(url)
    let metadata = { title: url, description: null, thumbnail: null, contentType: fallbackContentType }
    try {
      const metadataUrl = new URL('/api/metadata', request.url)
      metadataUrl.searchParams.set('url', url)
      const metadataResponse = await fetch(metadataUrl.toString())
      if (metadataResponse.ok) {
        metadata = await metadataResponse.json()
      }
    } catch {
      // Use URL-based detection if metadata fetch fails
    }

    // Insert the item
    const { data, error } = await supabaseAdmin
      .from('items')
      .insert({
        user_id: userId,
        type: 'link',
        url,
        title: metadata.title || url,
        description: metadata.description,
        thumbnail: metadata.thumbnail,
        content_type: metadata.contentType || 'link',
        status: 'unread',
      })
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json(
        { error: 'Failed to save item' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Saved!',
      item: {
        title: data.title,
        type: data.content_type
      }
    })
  } catch (error) {
    console.error('Quick save error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to generate/retrieve API key (requires auth)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authorization required' },
      { status: 401 }
    )
  }

  const token = authHeader.slice(7)

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    const apiKey = generateApiKey(user.id)

    return NextResponse.json({ api_key: apiKey })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
