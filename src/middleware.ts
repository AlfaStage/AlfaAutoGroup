import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  // '/l' e o encurtador: quem clica no WhatsApp nao tem sessao
  const publicRoutes = ['/login', '/api/auth', '/api/webhook', '/api/uploads', '/l/']
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

  // Chave de API: o middleware roda no edge e nao tem acesso ao banco, entao
  // ele apenas deixa passar — quem valida a chave e a propria rota, via
  // isAuthenticated(). Sem chave valida, a rota responde 401.
  const temChaveApi = (request.headers.get('authorization') || '')
    .toLowerCase()
    .startsWith('bearer ')
  if (temChaveApi && pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const token = await getToken({ req: request })
  
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
