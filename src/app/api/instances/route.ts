import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"

export async function GET() {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
