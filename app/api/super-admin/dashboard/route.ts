// app/api/super-admin/dashboard/route.ts
import { NextResponse } from "next/server";

// VERSÃO SIMPLIFICADA PARA TESTE (sem Prisma)
// Use esta versão se ainda não configurou o Prisma

export async function GET() {
  try {
    // Dados mockados para teste
    const mockData = {
      totalInstitutions: 4,
      activeInstitutions: 3,
      inactiveInstitutions: 1,
      totalUsers: 12,
      totalRevenue: 45000,
      pendingPayments: 3,
      overduePayments: 1,
    };

    return NextResponse.json(mockData);
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar estatísticas" },
      { status: 500 }
    );
  }
}

// VERSÃO COM PRISMA (use depois de configurar o banco)
/*
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const totalInstitutions = await prisma.institution.count();
    const activeInstitutions = await prisma.institution.count({
      where: { status: "active" },
    });
    const inactiveInstitutions = await prisma.institution.count({
      where: { status: "inactive" },
    });
    const totalUsers = await prisma.user.count();
    
    const paymentsData = await prisma.payment.aggregate({
      where: { status: "paid" },
      _sum: { amount: true },
    });
    const totalRevenue = paymentsData._sum.amount || 0;
    
    const pendingPayments = await prisma.payment.count({
      where: { status: "pending" },
    });
    
    const overduePayments = await prisma.payment.count({
      where: { status: "overdue" },
    });

    return NextResponse.json({
      totalInstitutions,
      activeInstitutions,
      inactiveInstitutions,
      totalUsers,
      totalRevenue,
      pendingPayments,
      overduePayments,
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar estatísticas" },
      { status: 500 }
    );
  }
}
*/
