import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Listar pagamentos
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || "current";

    let whereClause: any = {};

    if (month === "current") {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      whereClause.dueDate = {
        gte: startOfMonth,
        lte: endOfMonth,
      };
    } else if (month === "last") {
      const now = new Date();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      
      whereClause.dueDate = {
        gte: startOfLastMonth,
        lte: endOfLastMonth,
      };
    }

    const payments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        institution: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { dueDate: "desc" },
    });

    const formattedPayments = payments.map((payment) => ({
      id: payment.id,
      institutionId: payment.institutionId,
      institutionName: payment.institution.name,
      amount: payment.amount,
      dueDate: payment.dueDate,
      paymentDate: payment.paymentDate,
      status: payment.status,
      method: payment.method,
      reference: payment.reference,
    }));

    return NextResponse.json(formattedPayments);
  } catch (error) {
    console.error("Erro ao buscar pagamentos:", error);
    return NextResponse.json(
      { error: "Erro ao buscar pagamentos" },
      { status: 500 }
    );
  }
}

// API route para estatísticas financeiras
export async function getFinancialStats() {
  try {
    // Total recebido
    const paidPayments = await prisma.payment.aggregate({
      where: { status: "paid" },
      _sum: { amount: true },
    });
    const totalReceived = paidPayments._sum.amount || 0;

    // Total pendente
    const pendingPayments = await prisma.payment.aggregate({
      where: { status: "pending" },
      _sum: { amount: true },
    });
    const totalPending = pendingPayments._sum.amount || 0;

    // Total vencido
    const overduePayments = await prisma.payment.aggregate({
      where: { status: "overdue" },
      _sum: { amount: true },
    });
    const totalOverdue = overduePayments._sum.amount || 0;

    // MRR (Monthly Recurring Revenue)
    const activeInstitutions = await prisma.institution.aggregate({
      where: { status: "active" },
      _sum: { monthlyFee: true },
    });
    const monthlyRecurring = activeInstitutions._sum.monthlyFee || 0;

    // Taxa de pagamento (parcelas pagas no prazo)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const totalDueThisMonth = await prisma.payment.count({
      where: {
        dueDate: { gte: startOfMonth },
      },
    });

    const paidOnTime = await prisma.payment.count({
      where: {
        dueDate: { gte: startOfMonth },
        status: "paid",
        paymentDate: { lte: prisma.payment.fields.dueDate },
      },
    });

    const paymentRate = totalDueThisMonth > 0 
      ? (paidOnTime / totalDueThisMonth) * 100 
      : 0;

    return {
      totalReceived,
      totalPending,
      totalOverdue,
      monthlyRecurring,
      paymentRate,
    };
  } catch (error) {
    console.error("Erro ao calcular estatísticas:", error);
    throw error;
  }
}
