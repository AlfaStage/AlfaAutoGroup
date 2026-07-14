import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"

/**
 * @swagger
 * /api/instances:
 *   get:
 *     summary: Lista todas as instâncias do WhatsApp (Evolution API)
 *     description: Retorna as instâncias configuradas e seus status de conexão.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Lista de instâncias.
 *       401:
 *         description: Não autorizado (Sessão inválida ou Bearer token incorreto).
 */
export async function GET(request: Request) {
  try {
    const aiToken = request.headers.get('authorization')?.replace('Bearer ', '');
    let isAuthenticated = false;
    
    if (aiToken && aiToken === process.env.AI_API_KEY) {
      isAuthenticated = true;
    } else {
      const session = await getServerSession()
      if (session) isAuthenticated = true;
    }

    if (!isAuthenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiUrl = process.env.EVOLUTION_API_URL
    const apiKey = process.env.EVOLUTION_API_KEY

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: 'Evolution API credentials missing' }, { status: 500 })
    }

    const res = await fetch(`${apiUrl}/instance/all`, {
      method: 'GET',
      headers: {
        'apikey': apiKey
      },
      cache: 'no-store'
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch instances' }, { status: res.status })
    }

    const data = await res.json()
    // Data is usually an array of instances
    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro ao buscar instancias:", error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
