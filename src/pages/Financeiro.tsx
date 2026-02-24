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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DollarSign, FileText, CheckCircle2, Clock, AlertTriangle,
  Search, Eye, Building2, Filter,
} from "lucide-react";
import { motion } from "framer-motion";

// ─── Helpers ────────────────────────────────────────────────
function parseCurrency(val: string): number {
  if (!val) return 0;
  // Remove currency symbol, then handle Brazilian format: dots as thousand separators, comma as decimal
  // If there's a comma, it's definitely Brazil/Europe format.
  let cleaned = val.replace(/[^\d,.-]/g, "");
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }
  return parseFloat(cleaned) || 0;
}


function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Sub-components ─────────────────────────────────────────

function SummaryCard({ title, value, icon: Icon, color, delay }: {
  title: string; value: string; icon: React.ElementType; color: string; delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className={`p-2 rounded-lg bg-muted ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-lg font-bold text-foreground">{value}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main ───────────────────────────────────────────────────

export default function Financeiro() {
  const { contratos, parcelas, getParcelasContrato, updateParcela, getSetorNome, addLog } = useData();
  const { currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [empresaFilter, setEmpresaFilter] = useState("todas");
  const [selectedContrato, setSelectedContrato] = useState<string | null>(null);

  // Only active (non-deleted) contracts
  const contratosAtivos = useMemo(() => contratos.filter(c => !c.excluido), [contratos]);

  // Unique company names for filter
  const empresasUnicas = useMemo(() => {
    const names = new Set(contratosAtivos.map(c => c.empresa));
    return Array.from(names).sort();
  }, [contratosAtivos]);

  // Filtered contracts
  const contratosFiltrados = useMemo(() => {
    return contratosAtivos.filter(c => {
      const matchSearch = !search ||
        c.numero.toLowerCase().includes(search.toLowerCase()) ||
        c.empresa.toLowerCase().includes(search.toLowerCase()) ||
        c.descricao.toLowerCase().includes(search.toLowerCase());

      const matchEmpresa = empresaFilter === "todas" || c.empresa === empresaFilter;

      let matchStatus = true;
      if (statusFilter === "quitado") matchStatus = c.status === "Quitado";
      else if (statusFilter === "em_aberto") matchStatus = c.status === "Em Aberto";
      else if (statusFilter === "vigente") matchStatus = c.status === "Vigente" || c.status === "Vencendo";
      else if (statusFilter === "vencido") matchStatus = c.status === "Vencido";

      return matchSearch && matchEmpresa && matchStatus;
    });
  }, [contratosAtivos, search, statusFilter, empresaFilter]);

  // Summary calculations — based on filtered contracts
  const resumo = useMemo(() => {
    let valorTotal = 0;
    let totalParcelas = 0;
    let parcelasPagas = 0;
    let parcelasPendentes = 0;
    let valorPago = 0;
    let valorPendente = 0;

    contratosFiltrados.forEach(c => {
      valorTotal += parseCurrency(c.valor);
      const parcs = getParcelasContrato(c.id);
      totalParcelas += parcs.length;
      parcs.forEach(p => {
        const pVal = parseCurrency(p.valor);
        if (p.status === "pago" || p.quitado) {
          parcelasPagas++;
          valorPago += pVal;
        } else {
          parcelasPendentes++;
          valorPendente += pVal;
        }
      });
    });

    return { valorTotal, totalParcelas, parcelasPagas, parcelasPendentes, valorPago, valorPendente };
  }, [contratosFiltrados, getParcelasContrato, parcelas]);

  // Parcelas for selected contract
  const parcelasContrato = useMemo(() => {
    if (!selectedContrato) return [];
    return getParcelasContrato(selectedContrato).sort((a, b) => a.numero - b.numero);
  }, [selectedContrato, getParcelasContrato, parcelas]);

  const contratoSelecionado = contratosAtivos.find(c => c.id === selectedContrato);

  const handleBaixaParcela = (parcelaId: string) => {
    updateParcela(parcelaId, { status: "pago", quitado: true });
    if (currentUser && contratoSelecionado) {
      addLog(currentUser.id, currentUser.nome, "Baixa Parcela",
        `Parcela marcada como paga no contrato ${contratoSelecionado.numero}`);
    }
    toast({ title: "Parcela quitada", description: "Prestação marcada como paga." });
  };

  const handleEstornarParcela = (parcelaId: string) => {
    updateParcela(parcelaId, { status: "pendente", quitado: false });
    if (currentUser && contratoSelecionado) {
      addLog(currentUser.id, currentUser.nome, "Estorno Parcela",
        `Parcela estornada no contrato ${contratoSelecionado.numero}`);
    }
    toast({ title: "Parcela estornada", description: "Prestação voltou para pendente." });
  };

  // Per-company summary (when company filter is applied)
  const resumoPorEmpresa = useMemo(() => {
    const map: Record<string, { total: number; pagas: number; pendentes: number; valorPago: number; valorPendente: number }> = {};
    contratosFiltrados.forEach(c => {
      if (!map[c.empresa]) map[c.empresa] = { total: 0, pagas: 0, pendentes: 0, valorPago: 0, valorPendente: 0 };
      const entry = map[c.empresa];
      const parcs = getParcelasContrato(c.id);
      entry.total += parcs.length;
      parcs.forEach(p => {
        const pVal = parseCurrency(p.valor);
        if (p.status === "pago" || p.quitado) {
          entry.pagas++;
          entry.valorPago += pVal;
        } else {
          entry.pendentes++;
          entry.valorPendente += pVal;
        }
      });
    });
    return map;
  }, [contratosFiltrados, getParcelasContrato, parcelas]);

  const cards = [
    { title: "Valor Total Contratos", value: formatCurrency(resumo.valorTotal), icon: DollarSign, color: "text-primary" },
    { title: "Total de Prestações", value: resumo.totalParcelas.toString(), icon: FileText, color: "text-muted-foreground" },
    { title: "Prestações Pagas", value: `${resumo.parcelasPagas} (${formatCurrency(resumo.valorPago)})`, icon: CheckCircle2, color: "text-green-500" },
    { title: "Prestações Pendentes", value: `${resumo.parcelasPendentes} (${formatCurrency(resumo.valorPendente)})`, icon: AlertTriangle, color: "text-yellow-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground text-sm">Gestão financeira dos contratos — prestações e pagamentos</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <SummaryCard key={card.title} {...card} delay={i * 0.08} />
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
          <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <Building2 className="w-4 h-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Empresas</SelectItem>
              {empresasUnicas.map(e => (
                <SelectItem key={e} value={e}>{e.length > 40 ? e.substring(0, 40) + "…" : e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-1 text-muted-foreground" />
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

      {/* Per-company summary when filtering by company */}
      {empresaFilter !== "todas" && resumoPorEmpresa[empresaFilter] && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground text-sm">Resumo — {empresaFilter.length > 50 ? empresaFilter.substring(0, 50) + "…" : empresaFilter}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Total Prestações</p>
                <p className="font-bold">{resumoPorEmpresa[empresaFilter].total}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Pagas</p>
                <p className="font-bold text-green-600">{resumoPorEmpresa[empresaFilter].pagas} ({formatCurrency(resumoPorEmpresa[empresaFilter].valorPago)})</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Pendentes</p>
                <p className="font-bold text-yellow-600">{resumoPorEmpresa[empresaFilter].pendentes} ({formatCurrency(resumoPorEmpresa[empresaFilter].valorPendente)})</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Situação</p>
                {resumoPorEmpresa[empresaFilter].pendentes === 0 ? (
                  <div className="flex items-center gap-1 text-green-600 font-bold">
                    <CheckCircle2 className="w-4 h-4" /> Em dia
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-destructive font-bold">
                    <AlertTriangle className="w-4 h-4" /> Pendente
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <TableHead className="text-center">Qtd. Prestações</TableHead>
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
                    const pagas = parcs.filter(p => p.status === "pago" || p.quitado).length;
                    const pendentes = parcs.filter(p => p.status === "pendente" && !p.quitado).length;
                    const qtdPrestacoes = parcs.length || c.qtdPagamentos || 0;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.numero}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={c.empresa}>{c.empresa}</TableCell>
                        <TableCell>{getSetorNome(c.idSetor)}</TableCell>
                        <TableCell className="text-right font-mono">{c.valor}</TableCell>
                        <TableCell className="text-right font-mono">{c.valorPrestacao || "—"}</TableCell>
                        <TableCell className="text-center">{qtdPrestacoes || "—"}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-xs font-semibold text-foreground">{pagas}/{qtdPrestacoes}</span>
                            <div className="flex gap-0.5 mt-1">
                              {[...Array(Math.min(qtdPrestacoes, 12))].map((_, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    i < pagas ? "bg-green-500" : "bg-muted"
                                  )}
                                />
                              ))}
                              {qtdPrestacoes > 12 && <span className="text-[8px] text-muted-foreground">+</span>}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {pendentes > 0 ? (
                            <div className="flex items-center gap-1.5 text-destructive font-medium text-xs">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Em aberto ({pendentes})
                            </div>
                          ) : parcs.length > 0 ? (
                            <div className="flex items-center gap-1.5 text-green-600 font-medium text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Em dia
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Sem prestações</span>
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
                            Gerir
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

      {/* Parcelas Management Dialog */}
      <Dialog open={!!selectedContrato} onOpenChange={() => setSelectedContrato(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Ficha Financeira — {contratoSelecionado?.numero}
            </DialogTitle>
            {contratoSelecionado && (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mt-2">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Contrato Nº:</strong> {contratoSelecionado.numero}</p>
                  <p><strong>Empresa:</strong> {contratoSelecionado.empresa}</p>
                  <p><strong>Valor Total:</strong> {contratoSelecionado.valor}</p>
                  <p><strong>Prestações:</strong> {parcelasContrato.length || contratoSelecionado.qtdPagamentos || "—"}</p>
                  <p><strong>Vigência:</strong> {contratoSelecionado.dataInicio} — {contratoSelecionado.dataVencimento}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-primary border-primary/20 hover:bg-primary/5"
                    onClick={() => {
                      toast({ title: "Relatório Gerado", description: "O relatório financeiro foi enviado para processamento." });
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Gerar Relatório
                  </Button>
                  {parcelasContrato.some(p => p.status === "pendente") && (
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        parcelasContrato.filter(p => p.status === "pendente").forEach(p => handleBaixaParcela(p.id));
                        toast({ title: "Contrato Liquidado", description: "Todas as prestações foram marcadas como pagas." });
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Liquidar Tudo
                    </Button>
                  )}
                </div>

              </div>
            )}
          </DialogHeader>

          {/* Summary bar inside dialog */}
          {parcelasContrato.length > 0 && (
            <div className="grid grid-cols-5 gap-3 p-3 rounded-lg bg-muted/50 text-sm">
              <div className="text-center">
                <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Total</p>
                <p className="font-bold">{parcelasContrato.length}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Pagas</p>
                <p className="font-bold text-green-600">{parcelasContrato.filter(p => p.status === "pago" || p.quitado).length}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Aberto</p>
                <p className="font-bold text-yellow-600">{parcelasContrato.filter(p => p.status === "pendente" && !p.quitado).length}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Vencidas</p>
                <p className="font-bold text-destructive">
                  {parcelasContrato.filter(p => {
                    if (p.status === 'pago') return false;
                    const venc = new Date(p.dataVencimento);
                    return venc < new Date();
                  }).length}
                </p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-[10px] uppercase tracking-wider text-destructive">Soma Atraso</p>
                <p className="font-bold text-destructive font-mono">
                  {parcelasContrato.reduce((acc, p) => {
                    if (p.status === 'pago' || p.quitado) return acc;
                    const venc = new Date(p.dataVencimento);
                    if (venc < new Date()) {
                      const diff = Math.floor((new Date().getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
                      return acc + diff;
                    }
                    return acc;
                  }, 0)}d
                </p>
              </div>
            </div>


          )}

          {parcelasContrato.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nenhuma prestação cadastrada para este contrato.</p>
              <p className="text-xs mt-1">As prestações são geradas ao salvar o contrato com modelo de cobrança.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 mt-2">
              {parcelasContrato.map(p => {
                const isPago = p.status === "pago" || p.quitado;
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
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-muted-foreground">Vencimento: {p.dataVencimento}</p>
                          {!isPago && new Date(p.dataVencimento) < new Date() && (
                            <span className="text-[10px] text-destructive font-bold">
                              ({Math.floor((new Date().getTime() - new Date(p.dataVencimento).getTime()) / (1000 * 60 * 60 * 24))} dias de atraso)
                            </span>
                          )}
                        </div>
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
