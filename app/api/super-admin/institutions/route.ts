import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcrypt";

// GET - Listar todas as instituições
export async function GET() {
  try {
    const institutions = await prisma.institution.findMany({
      include: {
        _count: {
          select: { users: true },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedInstitutions = institutions.map((inst) => ({
      id: inst.id,
      name: inst.name,
      cnpj: inst.cnpj,
      email: inst.email,
      phone: inst.phone,
      status: inst.status,
      plan: inst.plan,
      monthlyFee: inst.monthlyFee,
      dueDay: inst.dueDay,
      usersCount: inst._count.users,
      createdAt: inst.createdAt,
      lastPayment: inst.payments[0]?.paymentDate || null,
    }));

    return NextResponse.json(formattedInstitutions);
  } catch (error) {
    console.error("Erro ao buscar instituições:", error);
    return NextResponse.json(
      { error: "Erro ao buscar instituições" },
      { status: 500 }
    );
  }
}

// POST - Criar nova instituição
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const {
      name,
      cnpj,
      email,
      phone,
      address,
      plan,
      monthlyFee,
      dueDay,
      status,
      adminUser,
    } = body;

    // Verificar se CNPJ já existe
    const existingInstitution = await prisma.institution.findUnique({
      where: { cnpj },
    });

    if (existingInstitution) {
      return NextResponse.json(
        { error: "CNPJ já cadastrado" },
        { status: 400 }
      );
    }

    // Verificar se email do admin já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: adminUser.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email do administrador já cadastrado" },
        { status: 400 }
      );
    }

    // Criar instituição e usuário admin em uma transação
    const institution = await prisma.$transaction(async (tx) => {
      // Criar instituição
      const newInstitution = await tx.institution.create({
        data: {
          name,
          cnpj,
          email,
          phone,
          address: JSON.stringify(address),
          plan,
          monthlyFee: parseFloat(monthlyFee),
          dueDay: parseInt(dueDay),
          status,
        },
      });

      // Gerar senha temporária
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await hash(tempPassword, 10);

      // Criar usuário admin
      const adminUserCreated = await tx.user.create({
        data: {
          name: adminUser.name,
          email: adminUser.email,
          phone: adminUser.phone,
          password: hashedPassword,
          role: "admin",
          status: "active",
          institutionId: newInstitution.id,
        },
      });

      // Criar primeira parcela (mês atual)
      const now = new Date();
      const dueDate = new Date(now.getFullYear(), now.getMonth(), parseInt(dueDay));
      
      await tx.payment.create({
        data: {
          institutionId: newInstitution.id,
          amount: parseFloat(monthlyFee),
          dueDate,
          status: "pending",
          reference: `${newInstitution.id}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`,
        },
      });

      // TODO: Enviar email para o admin com a senha temporária
      // await sendWelcomeEmail(adminUser.email, tempPassword);

      return newInstitution;
    });

    return NextResponse.json(institution, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar instituição:", error);
    return NextResponse.json(
      { error: "Erro ao criar instituição" },
      { status: 500 }
    );
  }
}
