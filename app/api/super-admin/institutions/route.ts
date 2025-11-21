// app/api/super-admin/institutions/route.ts
// API otimizada para Vercel Edge Runtime

import { NextResponse } from "next/server";

// Configurações para Edge Runtime
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Dados mockados para demonstração
const mockInstitutions = [
  {
    id: "1",
    name: "Colégio São Francisco",
    cnpj: "12.345.678/0001-90",
    email: "contato@saofran.edu.br",
    phone: "(11) 98765-4321",
    status: "active",
    plan: "premium",
    monthlyFee: 1500.0,
    dueDay: 10,
    usersCount: 5,
    createdAt: new Date().toISOString(),
    lastPayment: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Instituto Educacional ABC",
    cnpj: "98.765.432/0001-10",
    email: "contato@abc.edu.br",
    phone: "(21) 91234-5678",
    status: "active",
    plan: "standard",
    monthlyFee: 800.0,
    dueDay: 15,
    usersCount: 3,
    createdAt: new Date().toISOString(),
    lastPayment: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Escola Mundo Novo",
    cnpj: "11.222.333/0001-44",
    email: "contato@mundonovo.edu.br",
    phone: "(31) 99876-5432",
    status: "inactive",
    plan: "basic",
    monthlyFee: 500.0,
    dueDay: 5,
    usersCount: 4,
    createdAt: new Date().toISOString(),
    lastPayment: null,
  },
];

// GET - Listar instituições
export async function GET() {
  try {
    return NextResponse.json(mockInstitutions);
  } catch (error) {
    console.error("Erro ao buscar instituições:", error);
    return NextResponse.json(
      { error: "Erro ao buscar instituições" },
      { status: 500 }
    );
  }
}

// POST - Criar instituição
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const newInstitution = {
      id: String(Date.now()),
      ...body,
      usersCount: 1,
      createdAt: new Date().toISOString(),
      lastPayment: null,
    };

    mockInstitutions.push(newInstitution);

    return NextResponse.json(newInstitution, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar instituição:", error);
    return NextResponse.json(
      { error: "Erro ao criar instituição" },
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
    const { data: institutions, error } = await supabase
      .from('institutions')
      .select(`
        *,
        users:users(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = institutions?.map(inst => ({
      ...inst,
      usersCount: inst.users?.[0]?.count || 0,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Erro:", error);
    return NextResponse.json({ error: "Erro ao buscar instituições" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('institutions')
      .insert([body])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Erro:", error);
    return NextResponse.json({ error: "Erro ao criar instituição" }, { status: 500 });
  }
}
*/
