import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name } = await params
    const apiUrl = process.env.EVOLUTION_API_URL
    const apiKey = process.env.EVOLUTION_API_KEY
    const instanceToken = request.headers.get('x-instance-token') || apiKey

    if (!apiUrl || !instanceToken) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 })
    }

    const res = await fetch(`${apiUrl}/user/contacts?instanceName=${name}`, {
      method: 'GET',
      headers: {
        'apikey': instanceToken
      },
      cache: 'no-store'
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro ao buscar contatos:", error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
