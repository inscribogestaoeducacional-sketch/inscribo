import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Ajuste conforme sua configuração

export async function GET() {
  try {
    // Total de instituições
    const totalInstitutions = await prisma.institution.count();
    
    // Instituições ativas
    const activeInstitutions = await prisma.institution.count({
      where: { status: "active" },
    });
    
    // Instituições inativas
    const inactiveInstitutions = await prisma.institution.count({
      where: { status: "inactive" },
    });
    
    // Total de usuários
    const totalUsers = await prisma.user.count();
    
    // Receita total (soma de todos os pagamentos confirmados)
    const paymentsData = await prisma.payment.aggregate({
      where: { status: "paid" },
      _sum: { amount: true },
    });
    const totalRevenue = paymentsData._sum.amount || 0;
    
    // Pagamentos pendentes
    const pendingPayments = await prisma.payment.count({
      where: { status: "pending" },
    });
    
    // Pagamentos vencidos
    const overduePayments = await prisma.payment.count({
      where: {
        status: "overdue",
      },
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
