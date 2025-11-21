// app/api/super-admin/institutions/route.ts
// VERSÃO MOCKADA PARA TESTE

import { NextResponse } from "next/server";

// Dados mockados para teste
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
    status: "active",
    plan: "basic",
    monthlyFee: 500.0,
    dueDay: 5,
    usersCount: 4,
    createdAt: new Date().toISOString(),
    lastPayment: null,
  },
];

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const newInstitution = {
      id: String(mockInstitutions.length + 1),
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
