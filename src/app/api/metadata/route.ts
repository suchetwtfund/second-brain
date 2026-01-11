import { NextRequest, NextResponse } from 'next/server'

interface Metadata {
  title: string
  description: string | null
  thumbnail: string | null
  contentType: 'video' | 'article' | 'substack' | 'tweet' | 'link'
}

// Detect content type from URL only (fallback when HTML not available)
function detectContentType(url: string): 'video' | 'article' | 'substack' | 'tweet' | 'link' {
  const hostname = new URL(url).hostname.toLowerCase()

  // Video platforms
  if (
    hostname.includes('youtube.com') ||
    hostname.includes('youtu.be') ||
    hostname.includes('vimeo.com') ||
    hostname.includes('twitch.tv') ||
    hostname.includes('dailymotion.com')
  ) {
    return 'video'
  }

  // Substack (separate from articles)
  if (hostname.includes('substack.com')) {
    return 'substack'
  }

  // Social/Tweet
  if (
    hostname.includes('twitter.com') ||
    hostname.includes('x.com') ||
    hostname.includes('threads.net')
  ) {
    return 'tweet'
  }

  // Article platforms
  if (
    hostname.includes('medium.com') ||
    hostname.includes('dev.to') ||
    hostname.includes('hashnode.com') ||
    hostname.includes('hackernoon.com') ||
    hostname.includes('freecodecamp.org') ||
    hostname.includes('blog.') ||
    hostname.includes('news.ycombinator.com')
  ) {
    return 'article'
  }

  return 'link'
}

// Smart content type detection using HTML signals
function detectContentTypeFromHtml(
  html: string,
  url: string
): 'video' | 'article' | 'substack' | 'tweet' | 'link' {
  const hostname = new URL(url).hostname.toLowerCase()
  const pathname = new URL(url).pathname.toLowerCase()

  // 1. Video platforms (check first, most specific)
  if (
    hostname.includes('youtube.com') ||
    hostname.includes('youtu.be') ||
    hostname.includes('vimeo.com') ||
    hostname.includes('twitch.tv') ||
    hostname.includes('dailymotion.com')
  ) {
    return 'video'
  }

  // 2. Substack
  if (hostname.includes('substack.com')) {
    return 'substack'
  }

  // 3. Twitter/X
  if (
    hostname.includes('twitter.com') ||
    hostname.includes('x.com') ||
    hostname.includes('threads.net')
  ) {
    return 'tweet'
  }

  // 4. Check og:type meta tag
  const ogType = extractMetaContent(html, 'og:type')
  if (ogType?.toLowerCase() === 'article') {
    return 'article'
  }

  // 5. Check for article-specific meta tags
  if (
    extractMetaContent(html, 'article:published_time') ||
    extractMetaContent(html, 'article:author') ||
    extractMetaContent(html, 'article:section')
  ) {
    return 'article'
  }

  // 6. Check for <article> HTML tag
  if (/<article[\s>]/i.test(html)) {
    return 'article'
  }

  // 7. URL pattern detection
  if (/\/(blog|article|post|posts|news|p)\//.test(pathname)) {
    return 'article'
  }

  // 8. Known article domains
  if (
    hostname.includes('medium.com') ||
    hostname.includes('dev.to') ||
    hostname.includes('hashnode.com') ||
    hostname.includes('hackernoon.com') ||
    hostname.includes('freecodecamp.org') ||
    hostname.includes('blog.') ||
    hostname.includes('news.ycombinator.com')
  ) {
    return 'article'
  }

  // 9. Default fallback
  return 'link'
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname.toLowerCase()

    // Special handling for Twitter/X
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return await handleTwitterUrl(url)
    }

    // Special handling for YouTube
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return await handleYouTubeUrl(url)
    }

    // Fetch the page with a browser-like user agent
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { title: url, description: null, thumbnail: null, contentType: detectContentType(url) },
        { status: 200 }
      )
    }

    const html = await response.text()
    const baseOrigin = parsedUrl.origin

    // Parse metadata from HTML
    let thumbnail = extractMetaContent(html, 'og:image') ||
                   extractMetaContent(html, 'twitter:image')

    // If no og:image, try to find favicon/apple-touch-icon as fallback
    if (!thumbnail) {
      const iconPath = extractAppleTouchIcon(html) || extractFavicon(html)
      if (iconPath) {
        thumbnail = iconPath.startsWith('http') ? iconPath : new URL(iconPath, baseOrigin).toString()
      } else {
        // Try common fallback paths and verify they exist
        const fallbackPaths = [
          '/apple-touch-icon.png',
          '/apple-touch-icon-precomposed.png',
          '/favicon-192x192.png',
          '/favicon-32x32.png',
          '/favicon.ico',
        ]
        for (const path of fallbackPaths) {
          const testUrl = `${baseOrigin}${path}`
          try {
            const testResponse = await fetch(testUrl, { method: 'HEAD' })
            if (testResponse.ok) {
              thumbnail = testUrl
              break
            }
          } catch {
            // Continue to next fallback
          }
        }
      }
    } else if (thumbnail && !thumbnail.startsWith('http')) {
      // Make thumbnail URL absolute if it's relative
      thumbnail = new URL(thumbnail, baseOrigin).toString()
    }

    const metadata: Metadata = {
      title: extractMetaContent(html, 'og:title') ||
             extractMetaContent(html, 'twitter:title') ||
             extractTitle(html) ||
             url,
      description: extractMetaContent(html, 'og:description') ||
                   extractMetaContent(html, 'twitter:description') ||
                   extractMetaContent(html, 'description'),
      thumbnail,
      contentType: detectContentTypeFromHtml(html, url),
    }

    return NextResponse.json(metadata)
  } catch {
    // Return basic metadata on error
    return NextResponse.json({
      title: url,
      description: null,
      thumbnail: null,
      contentType: detectContentType(url),
    })
  }
}

function extractMetaContent(html: string, property: string): string | null {
  // Try property attribute
  const propertyMatch = html.match(
    new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i')
  )
  if (propertyMatch) return propertyMatch[1]

  // Try content first, then property
  const contentFirstMatch = html.match(
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, 'i')
  )
  if (contentFirstMatch) return contentFirstMatch[1]

  // Try name attribute
  const nameMatch = html.match(
    new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i')
  )
  if (nameMatch) return nameMatch[1]

  // Try content first, then name
  const nameContentMatch = html.match(
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${property}["']`, 'i')
  )
  if (nameContentMatch) return nameContentMatch[1]

  return null
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return match ? match[1].trim() : null
}

function extractAppleTouchIcon(html: string): string | null {
  // Look for apple-touch-icon (highest quality icon usually)
  // Try to find the largest size first
  const sizeMatch = html.match(/<link[^>]*rel=["']apple-touch-icon[^"']*["'][^>]*sizes=["'](\d+)x\d+["'][^>]*href=["']([^"']+)["']/gi)
  if (sizeMatch) {
    // Find the largest icon
    let largestSize = 0
    let largestHref = null
    for (const match of sizeMatch) {
      const sizeNum = match.match(/sizes=["'](\d+)x/i)
      const href = match.match(/href=["']([^"']+)["']/i)
      if (sizeNum && href) {
        const size = parseInt(sizeNum[1])
        if (size > largestSize) {
          largestSize = size
          largestHref = href[1]
        }
      }
    }
    if (largestHref) return largestHref
  }

  // Fallback to any apple-touch-icon
  const match = html.match(/<link[^>]*rel=["']apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/i) ||
                html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon[^"']*["']/i)
  return match ? match[1] : null
}

function extractFavicon(html: string): string | null {
  // Look for various favicon formats, prioritizing larger sizes
  const patterns = [
    // Large PNG icons first
    /<link[^>]*rel=["']icon["'][^>]*sizes=["']192x192["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*rel=["']icon["'][^>]*sizes=["']128x128["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*rel=["']icon["'][^>]*sizes=["']96x96["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*rel=["']icon["'][^>]*sizes=["']32x32["'][^>]*href=["']([^"']+)["']/i,
    // Any icon with type PNG
    /<link[^>]*rel=["']icon["'][^>]*type=["']image\/png["'][^>]*href=["']([^"']+)["']/i,
    // Generic icon
    /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']icon["']/i,
    // Shortcut icon
    /<link[^>]*rel=["']shortcut icon["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']shortcut icon["']/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) return match[1]
  }

  return null
}

// Handle Twitter/X URLs - use bot user-agent to get OpenGraph tags
async function handleTwitterUrl(url: string): Promise<NextResponse> {
  try {
    // First, expand t.co short URLs
    let expandedUrl = url
    if (url.includes('t.co/')) {
      try {
        const redirectResponse = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
        })
        expandedUrl = redirectResponse.url
      } catch {
        // Keep original URL if redirect fails
      }
    }

    // Use a bot user-agent that Twitter recognizes (like WhatsApp)
    // Twitter serves proper OpenGraph tags to these bots
    const response = await fetch(expandedUrl, {
      headers: {
        'User-Agent': 'WhatsApp/2.23.20.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    })

    if (response.ok) {
      const html = await response.text()

      // Extract OpenGraph tags that Twitter serves to bots
      const ogTitle = extractMetaContent(html, 'og:title')
      const ogDescription = extractMetaContent(html, 'og:description')
      const ogImage = extractMetaContent(html, 'og:image')

      if (ogTitle || ogImage) {
        return NextResponse.json({
          title: ogTitle || 'Tweet',
          description: ogDescription,
          thumbnail: ogImage,
          contentType: 'tweet',
        })
      }
    }

    // Fallback: try syndication API
    const tweetIdMatch = expandedUrl.match(/status\/(\d+)/)
    const tweetId = tweetIdMatch?.[1]

    if (tweetId) {
      const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=0`
      const syndicationResponse = await fetch(syndicationUrl)

      if (syndicationResponse.ok) {
        const data = await syndicationResponse.json()

        let thumbnail = null
        if (data.mediaDetails && data.mediaDetails.length > 0) {
          thumbnail = data.mediaDetails[0].media_url_https
        } else if (data.photos && data.photos.length > 0) {
          thumbnail = data.photos[0].url
        } else if (data.user?.profile_image_url_https) {
          thumbnail = data.user.profile_image_url_https.replace('_normal', '_400x400')
        }

        const authorName = data.user?.name || data.user?.screen_name || ''
        const text = data.text || ''

        return NextResponse.json({
          title: authorName ? `${authorName} on X` : 'Tweet',
          description: text.substring(0, 200),
          thumbnail,
          contentType: 'tweet',
        })
      }
    }
  } catch (e) {
    console.error('Twitter fetch error:', e)
  }

  // Final fallback
  return NextResponse.json({
    title: 'Tweet',
    description: null,
    thumbnail: null,
    contentType: 'tweet',
  })
}

// Handle YouTube URLs
async function handleYouTubeUrl(url: string): Promise<NextResponse> {
  try {
    const parsedUrl = new URL(url)
    let videoId: string | null = null

    // Extract video ID from various YouTube URL formats
    if (parsedUrl.hostname.includes('youtu.be')) {
      videoId = parsedUrl.pathname.slice(1)
    } else {
      videoId = parsedUrl.searchParams.get('v')
    }

    if (videoId) {
      // YouTube thumbnail URLs are predictable
      const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

      // Try to get title from oEmbed
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      const response = await fetch(oembedUrl)

      if (response.ok) {
        const data = await response.json()
        return NextResponse.json({
          title: data.title || 'YouTube Video',
          description: data.author_name ? `by ${data.author_name}` : null,
          thumbnail,
          contentType: 'video',
        })
      }

      // Fallback with just thumbnail
      return NextResponse.json({
        title: 'YouTube Video',
        description: null,
        thumbnail,
        contentType: 'video',
      })
    }
  } catch (e) {
    console.error('YouTube fetch error:', e)
  }

  return NextResponse.json({
    title: 'YouTube Video',
    description: null,
    thumbnail: null,
    contentType: 'video',
  })
}
