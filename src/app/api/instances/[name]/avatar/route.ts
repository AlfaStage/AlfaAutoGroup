import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getInstanceToken, fetchAvatarUrl } from '@/lib/evolution'
import { readFile, writeFile, mkdir, stat } from 'fs/promises'
import { join } from 'path'

// A página de grupo renderiza uma <img> por membro. Sem cache em disco isso
// vira uma chamada à Evolution por avatar a cada carregamento — era uma das
// fontes de carga que derrubavam a conexão.
const AVATAR_TTL_MS = 7 * 24 * 60 * 60 * 1000

function cacheFilename(jid: string) {
  return `avatar-${jid.replace(/[^a-zA-Z0-9]/g, '')}.jpg`
}

function imageResponse(buffer: Buffer) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400'
    }
  })
}

/**
 * @swagger
 * /api/instances/{name}/avatar:
 *   get:
 *     summary: Foto de perfil de um contato ou grupo
 *     description: Retorna a imagem, servida de um cache local. Aceita JID de contato ou de grupo.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: jid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Imagem JPEG.
 *       404:
 *         description: Sem foto de perfil.
 */
export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name } = await params
    const jid = new URL(request.url).searchParams.get('jid')
    if (!jid) return NextResponse.json({ error: 'Missing jid' }, { status: 400 })

    const uploadsDir = join(process.cwd(), 'uploads')
    const filepath = join(uploadsDir, cacheFilename(jid))

    // 1. Cache quente
    try {
      const info = await stat(filepath)
      if (Date.now() - info.mtimeMs < AVATAR_TTL_MS) {
        return imageResponse(await readFile(filepath))
      }
    } catch { /* sem cache ainda */ }

    // 2. Busca na Evolution (exige o token da instância, não a chave global)
    const token = request.headers.get('x-instance-token') || await getInstanceToken(name)
    if (!token) return new NextResponse(null, { status: 404 })

    const url = await fetchAvatarUrl(token, jid)
    if (!url) return new NextResponse(null, { status: 404 })

    const img = await fetch(url, { cache: 'no-store' })
    if (!img.ok) return new NextResponse(null, { status: 404 })

    const buffer = Buffer.from(await img.arrayBuffer())
    try {
      await mkdir(uploadsDir, { recursive: true })
      await writeFile(filepath, buffer)
    } catch (e) {
      console.error('Falha ao gravar cache de avatar:', e)
    }

    return imageResponse(buffer)
  } catch (error) {
    console.error("Erro ao buscar avatar:", error)
    return new NextResponse(null, { status: 404 })
  }
}
