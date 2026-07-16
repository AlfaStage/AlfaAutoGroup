import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/api/auth', '/api/webhook']
  const isPublic = publicRoutes.some(route => pathname.startsWith(route))
  
  // Static assets and internal next routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/manifest') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/sw.js') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next()
  }

  if (isPublic) {
    return NextResponse.next()
  }

  const token = await getToken({ req: request })
  
  // Allow AI API Key bypass
  const aiToken = request.headers.get('authorization')?.replace('Bearer ', '');
  const expectedKey = process.env.AI_API_KEY || "gdngfbgsefgrdthfyjgumh76543gdbhr6j7yht";
  if (aiToken && aiToken === expectedKey) {
    return NextResponse.next()
  }
  
  if (!token) {
    // API routes return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    // Pages redirect to login
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
