import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  url.pathname = '/llm.txt'
  return NextResponse.redirect(url, 307)
}
