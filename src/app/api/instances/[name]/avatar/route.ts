import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name } = await params
    const { searchParams } = new URL(request.url)
    const jid = searchParams.get('jid')
    
    if (!jid) {
      return NextResponse.json({ error: 'Missing jid' }, { status: 400 })
    }

    const apiUrl = process.env.EVOLUTION_API_URL
    const apiKey = process.env.EVOLUTION_API_KEY
    const instanceToken = request.headers.get('x-instance-token') || apiKey

    if (!apiUrl || !instanceToken) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 })
    }

    const res = await fetch(`${apiUrl}/user/avatar?instanceName=${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': instanceToken
      },
      body: JSON.stringify({ number: jid, preview: false }),
      cache: 'no-store'
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch avatar' }, { status: res.status })
    }

    const data = await res.json()
    if (data.error || !data.data?.url) {
      // Retorna uma imagem em branco ou um 404
      return new NextResponse(null, { status: 404 })
    }
    return NextResponse.redirect(data.data.url)
  } catch (error) {
    console.error("Erro ao buscar avatar:", error)
    return new NextResponse('Internal error', { status: 500 })
  }
}
