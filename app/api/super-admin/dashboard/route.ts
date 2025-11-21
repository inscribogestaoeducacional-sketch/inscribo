// app/api/super-admin/dashboard/route.ts
// API otimizada para Vercel Edge Runtime

import { NextResponse } from "next/server";

// Configurações para Edge Runtime
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// VERSÃO MOCKADA (use enquanto configura o banco)
export async function GET() {
  try {
    // Dados mockados para demonstração
    const mockStats = {
      totalInstitutions: 4,
      activeInstitutions: 3,
      inactiveInstitutions: 1,
      totalUsers: 12,
      totalRevenue: 45000,
      pendingPayments: 3,
      overduePayments: 1,
    };

    return NextResponse.json(mockStats);
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar estatísticas" },
      { status: 500 }
    );
  }
}

/* 
VERSÃO COM SUPABASE (use depois de configurar):

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Buscar estatísticas do Supabase
    const { count: totalInstitutions } = await supabase
      .from('institutions')
      .select('*', { count: 'exact', head: true });
    
    const { count: activeInstitutions } = await supabase
      .from('institutions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'paid');
    
    const totalRevenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    
    return NextResponse.json({
      totalInstitutions: totalInstitutions || 0,
      activeInstitutions: activeInstitutions || 0,
      inactiveInstitutions: (totalInstitutions || 0) - (activeInstitutions || 0),
      totalUsers: totalUsers || 0,
      totalRevenue,
      pendingPayments: 0,
      overduePayments: 0,
    });
  } catch (error) {
    console.error("Erro:", error);
    return NextResponse.json({ error: "Erro ao buscar dados" }, { status: 500 });
  }
}
*/
