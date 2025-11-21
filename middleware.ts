// middleware.ts (na raiz do projeto)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Clone a resposta
  const response = NextResponse.next();

  // Adicionar headers de segurança menos restritivos para desenvolvimento
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );

  // Verificar autenticação apenas em rotas super-admin
  if (request.nextUrl.pathname.startsWith("/super-admin")) {
    // Por enquanto, permitir acesso (você deve implementar verificação real)
    // const session = request.cookies.get("session");
    // if (!session) {
    //   return NextResponse.redirect(new URL("/login", request.url));
    // }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
