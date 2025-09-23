import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Inscribo - Gestão de Matrículas Inteligente',
  description: 'Centralize leads, visitas, matrículas e rematrículas em um só lugar. Sistema completo para instituições de ensino.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  )
}