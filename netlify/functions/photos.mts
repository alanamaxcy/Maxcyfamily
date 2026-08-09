import type { Config, Context } from '@netlify/functions'
import { errorResponse, photoStore } from '../lib/store.mts'
import { newId } from '../../shared/id.ts'

/**
 * Sleep-screen photos and profile pictures.
 *
 * POST /api/photos      → raw image body, returns { id }
 * GET  /api/photos/:id  → the image, cached hard (ids are immutable)
 * DELETE /api/photos/:id
 */

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/avif'])

export default async (request: Request, _context: Context): Promise<Response> => {
  const url = new URL(request.url)
  const id = url.pathname.replace(/^\/api\/photos\/?/, '').trim()
  const store = photoStore()

  try {
    if (request.method === 'POST') {
      const contentType = (request.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? ''
      if (!ALLOWED.has(contentType)) {
        return errorResponse(`Unsupported image type: ${contentType || 'unknown'}`, 415)
      }

      const buffer = await request.arrayBuffer()
      if (buffer.byteLength === 0) return errorResponse('Empty upload')
      if (buffer.byteLength > MAX_BYTES) {
        return errorResponse(`Image is too large (max ${MAX_BYTES / 1024 / 1024} MB)`, 413)
      }

      const photoId = newId('ph')
      await store.set(photoId, buffer, { metadata: { contentType, size: buffer.byteLength } })

      return new Response(JSON.stringify({ id: photoId }), {
        status: 201,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      })
    }

    if (!id) return errorResponse('Missing photo id', 404)

    if (request.method === 'GET') {
      const found = await store.getWithMetadata(id, { type: 'arrayBuffer' })
      if (!found?.data) return errorResponse('Photo not found', 404)

      return new Response(found.data, {
        headers: {
          'content-type': String(found.metadata?.['contentType'] ?? 'application/octet-stream'),
          // Ids never change contents, so this can be cached indefinitely.
          'cache-control': 'public, max-age=31536000, immutable',
        },
      })
    }

    if (request.method === 'DELETE') {
      await store.delete(id)
      return new Response(null, { status: 204 })
    }

    return errorResponse('Method not allowed', 405)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return errorResponse(`Photo error: ${message}`, 500)
  }
}

export const config: Config = { path: ['/api/photos', '/api/photos/:id'] }
