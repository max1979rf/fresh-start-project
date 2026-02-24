import { useState, useMemo } from "react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
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
  DollarSign,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Eye,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Financeiro() {
  const { contratos, parcelas, getParcelasContrato, updateParcela, getSetorNome, addLog } = useData();
  const { currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedContrato, setSelectedContrato] = useState<string | null>(null);

  // Only active (non-deleted) contracts
  const contratosAtivos = useMemo(() =>
    contratos.filter(c => !c.excluido),
    [contratos]
  );

  // Filtered contracts
  const contratosFiltrados = useMemo(() => {
    return contratosAtivos.filter(c => {
      const matchSearch = !search ||
        c.numero.toLowerCase().includes(search.toLowerCase()) ||
        c.empresa.toLowerCase().includes(search.toLowerCase()) ||
        c.descricao.toLowerCase().includes(search.toLowerCase());

      if (statusFilter === "todos") return matchSearch;
      if (statusFilter === "quitado") return matchSearch && c.status === "Quitado";
      if (statusFilter === "em_aberto") return matchSearch && c.status === "Em Aberto";
      if (statusFilter === "vigente") return matchSearch && (c.status === "Vigente" || c.status === "Vencendo");
      if (statusFilter === "vencido") return matchSearch && c.status === "Vencido";
      return matchSearch;
    });
  }, [contratosAtivos, search, statusFilter]);

  // Summary calculations
  const resumo = useMemo(() => {
    let valorTotal = 0;
    let totalParcelas = 0;
    let parcelasPagas = 0;
    let parcelasPendentes = 0;
    let valorPago = 0;
    let valorPendente = 0;

    contratosAtivos.forEach(c => {
      const val = parseFloat(c.valor.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
      valorTotal += val;
      const parcs = getParcelasContrato(c.id);
      totalParcelas += parcs.length;
      parcs.forEach(p => {
        const pVal = parseFloat(p.valor.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
        if (p.status === 'pago' || p.quitado) {
          parcelasPagas++;
          valorPago += pVal;
        } else {
          parcelasPendentes++;
          valorPendente += pVal;
        }
      });
    });

    return { valorTotal, totalParcelas, parcelasPagas, parcelasPendentes, valorPago, valorPendente };
  }, [contratosAtivos, getParcelasContrato, parcelas]);

  const formatCurrency = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Parcelas for selected contract
  const parcelasContrato = useMemo(() => {
    if (!selectedContrato) return [];
    return getParcelasContrato(selectedContrato).sort((a, b) => a.numero - b.numero);
  }, [selectedContrato, getParcelasContrato, parcelas]);

  const contratoSelecionado = contratosAtivos.find(c => c.id === selectedContrato);

  const handleBaixaParcela = (parcelaId: string) => {
    updateParcela(parcelaId, { status: 'pago', quitado: true });
    if (currentUser && contratoSelecionado) {
      addLog(
        currentUser.id,
        currentUser.nome,
        'Baixa Parcela',
        `Parcela marcada como paga no contrato ${contratoSelecionado.numero}`
      );
    }
  };

  const handleEstornarParcela = (parcelaId: string) => {
    updateParcela(parcelaId, { status: 'pendente', quitado: false });
    if (currentUser && contratoSelecionado) {
      addLog(
        currentUser.id,
        currentUser.nome,
        'Estorno Parcela',
        `Parcela estornada no contrato ${contratoSelecionado.numero}`
      );
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      'Vigente': { variant: 'default', label: 'Vigente' },
      'Vencendo': { variant: 'secondary', label: 'Vencendo' },
      'Vencido': { variant: 'destructive', label: 'Vencido' },
      'Encerrado': { variant: 'outline', label: 'Encerrado' },
      'Quitado': { variant: 'default', label: 'Quitado' },
      'Em Aberto': { variant: 'secondary', label: 'Em Aberto' },
    };
    const s = map[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;

  };

  const cards = [
    { title: "Valor Total Contratos", value: formatCurrency(resumo.valorTotal), icon: DollarSign, color: "text-primary" },
    { title: "Total de Parcelas", value: resumo.totalParcelas.toString(), icon: FileText, color: "text-muted-foreground" },
    { title: "Parcelas Pagas", value: `${resumo.parcelasPagas} (${formatCurrency(resumo.valorPago)})`, icon: CheckCircle2, color: "text-green-500" },
    { title: "Parcelas Pendentes", value: `${resumo.parcelasPendentes} (${formatCurrency(resumo.valorPendente)})`, icon: AlertTriangle, color: "text-yellow-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground text-sm">Gestão financeira dos contratos — parcelas e pagamentos</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-2 rounded-lg bg-muted ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                  <p className="text-lg font-bold text-foreground">{card.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nº, empresa ou descrição..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="vigente">Vigente</SelectItem>
              <SelectItem value="em_aberto">Em Aberto</SelectItem>
              <SelectItem value="quitado">Quitado</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contratos — Visão Financeira</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Contrato</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Valor Prestação</TableHead>
                  <TableHead className="text-center">Prestações</TableHead>
                  <TableHead className="text-center">Checklist</TableHead>
                  <TableHead>Alerta</TableHead>
                  <TableHead className="text-center">Ações</TableHead>

                </TableRow>
              </TableHeader>
              <TableBody>
                {contratosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum contrato encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  contratosFiltrados.map(c => {
                    const parcs = getParcelasContrato(c.id);
                    const pagas = parcs.filter(p => p.status === 'pago' || p.quitado).length;
                    const pendentes = parcs.filter(p => p.status === 'pendente' && !p.quitado).length;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.numero}</TableCell>
                        <TableCell>{c.empresa}</TableCell>
                        <TableCell>{getSetorNome(c.idSetor)}</TableCell>
                        <TableCell className="text-right font-mono">{c.valor}</TableCell>
                        <TableCell className="text-right font-mono">{c.valorPrestacao || '—'}</TableCell>
                        <TableCell className="text-center">{parcs.length || c.qtdPagamentos || '—'}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {pagas > 0 ? (
                              <div className="flex -space-x-1">
                                {[...Array(Math.min(pagas, 5))].map((_, i) => (
                                  <div key={i} className="w-2 h-2 rounded-full bg-green-500 border border-background" />
                                ))}
                                {pagas > 5 && <span className="text-[8px] text-muted-foreground ml-1">+{pagas - 5}</span>}
                              </div>
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-muted" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {pendentes > 0 ? (
                            <div className="flex items-center gap-1.5 text-destructive font-medium text-xs">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Pendente ({pendentes})
                            </div>
                          ) : parcs.length > 0 ? (
                            <div className="flex items-center gap-1.5 text-green-600 font-medium text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Tudo Ok
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Sem parcelas</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedContrato(c.id)}
                            className="h-8 px-2 text-xs"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Gerir Parcelas
                          </Button>
                        </TableCell>

                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Parcelas Dialog */}
      <Dialog open={!!selectedContrato} onOpenChange={() => setSelectedContrato(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Parcelas — {contratoSelecionado?.numero}
            </DialogTitle>
            {contratoSelecionado && (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mt-2">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Empresa:</strong> {contratoSelecionado.empresa}</p>
                  <p><strong>Valor Total:</strong> {contratoSelecionado.valor}</p>
                  <p><strong>Vigência:</strong> {contratoSelecionado.dataInicio} — {contratoSelecionado.dataVencimento}</p>
                </div>
                {parcelasContrato.some(p => p.status === 'pendente') && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 border-green-200 hover:bg-green-50"
                    onClick={() => {
                      parcelasContrato.filter(p => p.status === 'pendente').forEach(p => handleBaixaParcela(p.id));
                      toast({ title: "Contrato Liquidado", description: "Todas as parcelas foram marcadas como pagas." });
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Liquidar Tudo
                  </Button>
                )}
              </div>
            )}
          </DialogHeader>


          {parcelasContrato.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nenhuma parcela cadastrada para este contrato.</p>
              <p className="text-xs mt-1">As parcelas são geradas ao salvar o contrato com modelo de cobrança.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 mt-4">
              {parcelasContrato.map(p => {
                const isPago = p.status === 'pago' || p.quitado;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      isPago ? "bg-green-50/50 border-green-100" : "bg-card border-border"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                        isPago ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                      )}>
                        {p.numero}
                      </div>
                      <div>
                        <p className="text-sm font-semibold font-mono">{p.valor}</p>
                        <p className="text-[10px] text-muted-foreground">Vencimento: {p.dataVencimento}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPago ? (
                        <>
                          <Badge variant="default" className="bg-green-600 h-6">PAGO</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-[10px] text-destructive hover:bg-destructive/5"
                            onClick={() => handleEstornarParcela(p.id)}
                          >
                            Estornar
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700 h-8"
                          onClick={() => handleBaixaParcela(p.id)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Dar Baixa
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
