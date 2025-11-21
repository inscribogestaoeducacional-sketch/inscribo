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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  UserPlus,
  DollarSign,
  Building2,
  CheckCircle,
  XCircle,
  Filter,
} from "lucide-react";
import Link from "next/link";

interface Institution {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  status: "active" | "inactive" | "suspended";
  plan: string;
  monthlyFee: number;
  dueDay: number;
  usersCount: number;
  createdAt: string;
  lastPayment?: string;
}

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [filteredInstitutions, setFilteredInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  useEffect(() => {
    filterInstitutions();
  }, [searchTerm, statusFilter, institutions]);

  const fetchInstitutions = async () => {
    try {
      const response = await fetch("/api/super-admin/institutions");
      const data = await response.json();
      setInstitutions(data);
      setFilteredInstitutions(data);
    } catch (error) {
      console.error("Erro ao carregar instituições:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterInstitutions = () => {
    let filtered = institutions;

    if (searchTerm) {
      filtered = filtered.filter(
        (inst) =>
          inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inst.cnpj.includes(searchTerm) ||
          inst.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((inst) => inst.status === statusFilter);
    }

    setFilteredInstitutions(filtered);
  };

  const handleStatusChange = async (institutionId: string, newStatus: string) => {
    try {
      await fetch(`/api/super-admin/institutions/${institutionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchInstitutions();
    } catch (error) {
      console.error("Erro ao alterar status:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedInstitution) return;

    try {
      await fetch(`/api/super-admin/institutions/${selectedInstitution.id}`, {
        method: "DELETE",
      });
      setDeleteDialogOpen(false);
      setSelectedInstitution(null);
      fetchInstitutions();
    } catch (error) {
      console.error("Erro ao excluir instituição:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: { variant: "default" as const, icon: CheckCircle, label: "Ativa" },
      inactive: { variant: "secondary" as const, icon: XCircle, label: "Inativa" },
      suspended: { variant: "destructive" as const, icon: XCircle, label: "Suspensa" },
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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Instituições</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todas as instituições cadastradas
          </p>
        </div>
        <Link href="/super-admin/institutions/new">
          <Button size="lg">
            <Building2 className="mr-2 h-4 w-4" />
            Nova Instituição
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
                <SelectItem value="suspended">Suspensas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredInstitutions.length} Instituição(ões) encontrada(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instituição</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Mensalidade</TableHead>
                <TableHead>Usuários</TableHead>
                <TableHead>Cadastro</TableHead>
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
              ) : filteredInstitutions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Nenhuma instituição encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredInstitutions.map((institution) => (
                  <TableRow key={institution.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{institution.name}</p>
                        <p className="text-sm text-muted-foreground">
                          CNPJ: {institution.cnpj}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{institution.email}</p>
                        <p className="text-muted-foreground">{institution.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(institution.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{institution.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          R$ {institution.monthlyFee.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Venc: dia {institution.dueDay}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{institution.usersCount}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(institution.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/super-admin/institutions/${institution.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Visualizar
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/super-admin/institutions/${institution.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/super-admin/institutions/${institution.id}/users`}>
                              <UserPlus className="mr-2 h-4 w-4" />
                              Gerenciar Usuários
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/super-admin/institutions/${institution.id}/financial`}>
                              <DollarSign className="mr-2 h-4 w-4" />
                              Financeiro
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {institution.status === "active" ? (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(institution.id, "inactive")}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Desativar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(institution.id, "active")}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Ativar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setSelectedInstitution(institution);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a instituição{" "}
              <strong>{selectedInstitution?.name}</strong>? Esta ação não pode ser
              desfeita e todos os dados relacionados serão permanentemente removidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir Instituição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
