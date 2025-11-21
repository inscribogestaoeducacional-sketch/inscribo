// middleware.ts
// Middleware compatível com Vercel Edge Runtime

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg).*)",
  ],
};

export function middleware(request: NextRequest) {
  // Clonar a resposta
  const response = NextResponse.next();

  // Headers de segurança compatíveis com Edge Runtime
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://www.meuinscribo.com.br",
  ].join("; ");

  response.headers.set("Content-Security-Policy", cspHeader);
  
  // Permitir frames do mesmo domínio
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  
  // Proteção XSS
  response.headers.set("X-Content-Type-Options", "nosniff");

  return response;
}
