import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH - Confirmar/Atualizar pagamento
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status, paymentDate, method } = body;

    const payment = await prisma.payment.update({
      where: { id: params.id },
      data: {
        status,
        paymentDate: paymentDate ? new Date(paymentDate) : null,
        method,
      },
      include: {
        institution: true,
      },
    });

    // TODO: Enviar notificação/email sobre confirmação de pagamento
    // await sendPaymentConfirmationEmail(payment.institution.email, payment);

    // Registrar log de atividade
    await prisma.activityLog.create({
      data: {
        action: "update",
        entity: "payment",
        entityId: payment.id,
        description: `Pagamento ${status === "paid" ? "confirmado" : "atualizado"} - ${payment.institution.name}`,
        metadata: JSON.stringify({
          amount: payment.amount,
          method,
          paymentDate,
        }),
      },
    });

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Erro ao atualizar pagamento:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar pagamento" },
      { status: 500 }
    );
  }
}

// GET - Obter detalhes de um pagamento
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
      include: {
        institution: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Pagamento não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Erro ao buscar pagamento:", error);
    return NextResponse.json(
      { error: "Erro ao buscar pagamento" },
      { status: 500 }
    );
  }
}

// DELETE - Cancelar pagamento
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payment = await prisma.payment.update({
      where: { id: params.id },
      data: {
        status: "cancelled",
      },
    });

    // Registrar log
    await prisma.activityLog.create({
      data: {
        action: "delete",
        entity: "payment",
        entityId: payment.id,
        description: `Pagamento cancelado - ID: ${payment.reference}`,
      },
    });

    return NextResponse.json({ message: "Pagamento cancelado com sucesso" });
  } catch (error) {
    console.error("Erro ao cancelar pagamento:", error);
    return NextResponse.json(
      { error: "Erro ao cancelar pagamento" },
      { status: 500 }
    );
  }
}
