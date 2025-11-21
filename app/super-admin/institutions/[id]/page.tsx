"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Edit,
  Building2,
  MapPin,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Institution {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  address: any;
  plan: string;
  monthlyFee: number;
  dueDay: number;
  status: string;
  usersCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Payment {
  id: string;
  amount: number;
  dueDate: string;
  paymentDate?: string;
  status: string;
  method?: string;
  reference: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin?: string;
}

export default function InstitutionDetailsPage() {
  const params = useParams();
  const institutionId = params.id as string;

  const [institution, setInstitution] = useState<Institution | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInstitutionData();
  }, [institutionId]);

  const fetchInstitutionData = async () => {
    try {
      // Buscar dados da instituição
      const instResponse = await fetch(
        `/api/super-admin/institutions/${institutionId}`
      );
      const instData = await instResponse.json();
      setInstitution(instData);

      // Buscar pagamentos
      const paymentsResponse = await fetch(
        `/api/super-admin/institutions/${institutionId}/financial`
      );
      const paymentsData = await paymentsResponse.json();
      setPayments(paymentsData);

      // Buscar usuários
      const usersResponse = await fetch(
        `/api/super-admin/institutions/${institutionId}/users`
      );
      const usersData = await usersResponse.json();
      setUsers(usersData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !institution) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Carregando...</p>
      </div>
    );
  }

  const address = JSON.parse(institution.address);

  const getStatusBadge = (status: string) => {
    const variants = {
      active: { variant: "default" as const, icon: CheckCircle, label: "Ativa" },
      inactive: { variant: "secondary" as const, icon: XCircle, label: "Inativa" },
      suspended: {
        variant: "destructive" as const,
        icon: AlertCircle,
        label: "Suspensa",
      },
    };

    const config = variants[status as keyof typeof variants];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="text-sm">
        <Icon className="mr-1 h-4 w-4" />
        {config.label}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants = {
      paid: { variant: "default" as const, label: "Pago" },
      pending: { variant: "secondary" as const, label: "Pendente" },
      overdue: { variant: "destructive" as const, label: "Vencido" },
    };

    const config = variants[status as keyof typeof variants];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/super-admin/institutions">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{institution.name}</h1>
              {getStatusBadge(institution.status)}
            </div>
            <p className="text-muted-foreground mt-1">CNPJ: {institution.cnpj}</p>
          </div>
        </div>
        <Link href={`/super-admin/institutions/${institutionId}/edit`}>
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Editar Instituição
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Mensalidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {institution.monthlyFee.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Vencimento dia {institution.dueDay}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Pagos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {payments.filter((p) => p.status === "paid").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {payments.filter((p) => p.status !== "paid").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-6">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="users">Usuários ({users.length})</TabsTrigger>
          <TabsTrigger value="financial">
            Financeiro ({payments.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Informações */}
        <TabsContent value="info" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Dados Principais */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Dados da Instituição
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{institution.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CNPJ</p>
                  <p className="font-medium">{institution.cnpj}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plano</p>
                  <Badge variant="outline">{institution.plan}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Data de Cadastro
                  </p>
                  <p className="font-medium">
                    {new Date(institution.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Contato */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{institution.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium">{institution.phone}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Endereço */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereço
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">
                  {address.street}, {address.number}
                  {address.complement && ` - ${address.complement}`}
                </p>
                <p className="text-muted-foreground">
                  {address.neighborhood} - {address.city}/{address.state}
                </p>
                <p className="text-muted-foreground">CEP: {address.zipCode}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Usuários */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Usuários Cadastrados</CardTitle>
              <Link href={`/super-admin/institutions/${institutionId}/users`}>
                <Button>
                  <Users className="mr-2 h-4 w-4" />
                  Gerenciar Usuários
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{user.role}</Badge>
                      <Badge
                        variant={
                          user.status === "active" ? "default" : "secondary"
                        }
                      >
                        {user.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Financeiro */}
        <TabsContent value="financial">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Histórico de Pagamentos</CardTitle>
              <Link href={`/super-admin/institutions/${institutionId}/financial`}>
                <Button>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Ver Detalhes
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payments.slice(0, 10).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div>
                      <p className="font-medium">
                        R$ {payment.amount.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Vencimento:{" "}
                        {new Date(payment.dueDate).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPaymentStatusBadge(payment.status)}
                      {payment.method && (
                        <Badge variant="outline">{payment.method}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
