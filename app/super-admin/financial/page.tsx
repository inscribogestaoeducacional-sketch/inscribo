"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface Payment {
  id: string;
  institutionId: string;
  institutionName: string;
  amount: number;
  dueDate: string;
  paymentDate?: string;
  status: "paid" | "pending" | "overdue" | "cancelled";
  method?: string;
  reference: string;
}

interface FinancialStats {
  totalReceived: number;
  totalPending: number;
  totalOverdue: number;
  monthlyRecurring: number;
  paymentRate: number;
}

export default function FinancialPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<FinancialStats>({
    totalReceived: 0,
    totalPending: 0,
    totalOverdue: 0,
    monthlyRecurring: 0,
    paymentRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("current");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    fetchPayments();
    fetchStats();
  }, [monthFilter]);

  useEffect(() => {
    filterPayments();
  }, [statusFilter, payments]);

  const fetchPayments = async () => {
    try {
      const response = await fetch(
        `/api/super-admin/financial/payments?month=${monthFilter}`
      );
      const data = await response.json();
      setPayments(data);
      setFilteredPayments(data);
    } catch (error) {
      console.error("Erro ao carregar pagamentos:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/super-admin/financial/stats");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  const filterPayments = () => {
    let filtered = payments;

    if (statusFilter !== "all") {
      filtered = filtered.filter((payment) => payment.status === statusFilter);
    }

    setFilteredPayments(filtered);
  };

  const handleConfirmPayment = async () => {
    if (!selectedPayment) return;

    try {
      await fetch(`/api/super-admin/financial/payments/${selectedPayment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paid",
          paymentDate,
          method: paymentMethod,
        }),
      });
      setPaymentDialogOpen(false);
      setSelectedPayment(null);
      fetchPayments();
      fetchStats();
    } catch (error) {
      console.error("Erro ao confirmar pagamento:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      paid: {
        variant: "default" as const,
        icon: CheckCircle,
        label: "Pago",
      },
      pending: {
        variant: "secondary" as const,
        icon: Clock,
        label: "Pendente",
      },
      overdue: {
        variant: "destructive" as const,
        icon: AlertCircle,
        label: "Vencido",
      },
      cancelled: {
        variant: "outline" as const,
        icon: AlertCircle,
        label: "Cancelado",
      },
    };

    const config = variants[status as keyof typeof variants];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const exportToExcel = () => {
    // Implementar exportação para Excel
    alert("Exportando relatório...");
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão Financeira</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe pagamentos, parcelas e receitas
          </p>
        </div>
        <Button onClick={exportToExcel}>
          <Download className="mr-2 h-4 w-4" />
          Exportar Relatório
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Recebido
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {stats.totalReceived.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pagamentos confirmados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              R$ {stats.totalPending.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Aguardando pagamento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencido</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {stats.totalOverdue.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pagamentos atrasados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              R$ {stats.monthlyRecurring.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receita recorrente mensal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taxa de Pagamento
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.paymentRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Parcelas pagas no prazo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[200px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Mês Atual</SelectItem>
                <SelectItem value="last">Mês Anterior</SelectItem>
                <SelectItem value="all">Todos os Meses</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="overdue">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredPayments.length} Pagamento(s) encontrado(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referência</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Nenhum pagamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {payment.reference}
                      </code>
                    </TableCell>
                    <TableCell>{payment.institutionName}</TableCell>
                    <TableCell className="font-medium">
                      R$ {payment.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {new Date(payment.dueDate).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      {payment.paymentDate
                        ? new Date(payment.paymentDate).toLocaleDateString("pt-BR")
                        : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>
                      {payment.method ? (
                        <Badge variant="outline">{payment.method}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {payment.status === "pending" || payment.status === "overdue" ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setPaymentDialogOpen(true);
                          }}
                        >
                          Confirmar
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost">
                          Ver Detalhes
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment Confirmation Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              Confirme os detalhes do pagamento de{" "}
              <strong>{selectedPayment?.institutionName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Valor</Label>
                <p className="text-lg font-bold">
                  R$ {selectedPayment?.amount.toFixed(2)}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Vencimento</Label>
                <p className="text-lg font-medium">
                  {selectedPayment?.dueDate &&
                    new Date(selectedPayment.dueDate).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="paymentDate">Data do Pagamento *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="paymentMethod">Método de Pagamento *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                  <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={!paymentMethod || !paymentDate}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
