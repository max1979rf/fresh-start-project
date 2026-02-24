import React, { useState, useMemo } from "react";
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
  DollarSign, FileText, CheckCircle2, AlertTriangle,
  Search, Eye, Printer, Calendar
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────
function parseCurrency(val: any): number {
  if (typeof val === "number") return val;
  if (!val || typeof val !== "string") return 0;
  let cleaned = val.replace(/[R$ \s]/g, "");
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split('.');
    if (parts[parts.length - 1].length === 3 && parts.length > 1) {
      cleaned = cleaned.replace(/\./g, "");
    }
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatCurrency(val: number): string {
  if (isNaN(val)) return "R$ 0,00";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calculateDaysLate(vencimentoStr: string): number {
  if (!vencimentoStr) return 0;
  // Handle both ISO and BR
  let date: Date;
  if (vencimentoStr.includes('-')) {
    date = new Date(vencimentoStr);
  } else {
    const p = vencimentoStr.split('/');
    date = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  }

  if (isNaN(date.getTime())) return 0;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  if (date >= now) return 0;
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ─── Sub-components ─────────────────────────────────────────

function SummaryCard({ title, value, icon: Icon, color }: {
  title: string; value: string; icon: any; color: string;
}) {
  return (
    <Card className="hover:border-primary/50 transition-colors cursor-default">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn("p-2 rounded-lg bg-muted/50", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">{title}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main ───────────────────────────────────────────────────

export default function Financeiro() {
  const { contratos = [], parcelas = [], getParcelasContrato, updateParcela, addLog, appConfig } = useData() || {};
  const { currentUser } = useAuth() || {};
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [empresaFilter, setEmpresaFilter] = useState("todas");
  const [selectedContrato, setSelectedContrato] = useState<string | null>(null);

  const contratosAtivos = useMemo(() => (contratos || []).filter(c => !c.excluido), [contratos]);

  const empresasUnicas = useMemo(() => {
    const names = new Set(contratosAtivos.map(c => c.empresa).filter(Boolean));
    return Array.from(names).sort();
  }, [contratosAtivos]);

  const contratosFiltrados = useMemo(() => {
    return contratosAtivos.filter(c => {
      const num = c.numero || "";
      const emp = c.empresa || "";
      const des = c.descricao || "";
      const matchSearch = !search ||
        num.toLowerCase().includes(search.toLowerCase()) ||
        emp.toLowerCase().includes(search.toLowerCase()) ||
        des.toLowerCase().includes(search.toLowerCase());

      const matchEmpresa = empresaFilter === "todas" || c.empresa === empresaFilter;

      let matchStatus = true;
      if (statusFilter === "quitado") matchStatus = c.status === "Quitado";
      else if (statusFilter === "em_aberto") matchStatus = c.status === "Em Aberto";
      else if (statusFilter === "vigente") matchStatus = c.status === "Vigente" || c.status === "Vencendo";
      else if (statusFilter === "vencido") matchStatus = c.status === "Vencido";

      return matchSearch && matchEmpresa && matchStatus;
    });
  }, [contratosAtivos, search, statusFilter, empresaFilter]);

  const resumo = useMemo(() => {
    let valorTotal = 0;
    let totalParcelas = 0;
    let parcelasPagas = 0;
    let parcelasPendentes = 0;
    let valorPago = 0;
    let valorPendente = 0;

    contratosFiltrados.forEach(c => {
      valorTotal += parseCurrency(c.valor);
      const parcs = getParcelasContrato ? getParcelasContrato(c.id) : [];
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

  const parcelasContrato = useMemo(() => {
    if (!selectedContrato || !getParcelasContrato) return [];
    return getParcelasContrato(selectedContrato).sort((a, b) => a.numero - b.numero);
  }, [selectedContrato, getParcelasContrato, parcelas]);

  const contratoSelecionado = contratosAtivos.find(c => c.id === selectedContrato);

  const handleBaixaParcela = (parcelaId: string) => {
    if (updateParcela) updateParcela(parcelaId, { status: "pago", quitado: true });
    if (currentUser && contratoSelecionado && addLog) {
      addLog(currentUser.id, currentUser.nome, "Baixa Parcela",
        `Parcela marcada como paga no contrato ${contratoSelecionado.numero}`);
    }
    toast({ title: "Parcela quitada", description: "Prestação marcada como paga." });
  };

  const handleEstornarParcela = (parcelaId: string) => {
    if (updateParcela) updateParcela(parcelaId, { status: "pendente", quitado: false });
    if (currentUser && contratoSelecionado && addLog) {
      addLog(currentUser.id, currentUser.nome, "Estorno Parcela",
        `Parcela estornada no contrato ${contratoSelecionado.numero}`);
    }
    toast({ title: "Parcela estornada", description: "Prestação voltou para pendente." });
  };

  const handlePrintReport = () => {
    if (!contratoSelecionado) return;
    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) return;
    const companyName = appConfig?.nomeEmpresa || 'Gestão de Contratos';
    const now = new Date().toLocaleString('pt-BR');

    printWin.document.write(`<html><head><title>Ficha Financeira</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}</style></head><body>`);
    printWin.document.write(`<h1>Contrato: ${contratoSelecionado.numero}</h1>`);
    printWin.document.write(`<h2>Empresa: ${contratoSelecionado.empresa}</h2>`);
    printWin.document.write(`<p>Relatório gerado em ${now} por ${companyName}</p>`);
    printWin.document.write(`<table><thead><tr><th>Nº</th><th>Valor</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>`);
    parcelasContrato.forEach(p => {
      printWin.document.write(`<tr><td>${p.numero}</td><td>${p.valor}</td><td>${p.dataVencimento}</td><td>${p.quitado ? 'PAGO' : 'PENDENTE'}</td></tr>`);
    });
    printWin.document.write(`</tbody></table></body></html>`);
    printWin.document.close();
    printWin.print();
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground text-sm">IAX Experience v1.2</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Contratos" value={formatCurrency(resumo.valorTotal)} icon={DollarSign} color="text-blue-600" />
        <SummaryCard title="Prestações Total" value={resumo.totalParcelas.toString()} icon={FileText} color="text-slate-600" />
        <SummaryCard title="Total Pago" value={formatCurrency(resumo.valorPago)} icon={CheckCircle2} color="text-emerald-600" />
        <SummaryCard title="A Receber" value={formatCurrency(resumo.valorPendente)} icon={AlertTriangle} color="text-amber-600" />
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nº, empresa ou descrição..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-muted/20 border-border/50"
            />
          </div>
          <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
            <SelectTrigger className="w-full sm:w-[200px] bg-muted/20 border-border/50">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Empresas</SelectItem>
              {empresasUnicas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px] bg-muted/20 border-border/50">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="vigente">Vigente</SelectItem>
              <SelectItem value="em_aberto">Em Aberto</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="quitado">Quitado</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border/50 overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[100px]">Nº</TableHead>
              <TableHead>Empresa / Descrição</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead className="text-center w-[150px]">Checklist</TableHead>
              <TableHead className="text-center w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contratosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">
                  Nenhum registro localizado
                </TableCell>
              </TableRow>
            ) : (
              contratosFiltrados.map(c => {
                const parcs = getParcelasContrato ? getParcelasContrato(c.id) : [];
                const pagas = parcs.filter(p => p.quitado).length;
                return (
                  <TableRow key={c.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-bold text-primary">{c.numero}</TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{c.empresa}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[300px]">{c.descricao}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-foreground">{c.valor}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex gap-0.5 justify-center flex-wrap max-w-[80px]">
                          {parcs.sort((a, b) => a.numero - b.numero).map(p => {
                            const isLate = !p.quitado && calculateDaysLate(p.dataVencimento) > 0;
                            return (
                              <div
                                key={p.id}
                                className={cn(
                                  "w-2 h-2 rounded-full",
                                  p.quitado ? "bg-emerald-500" : (isLate ? "bg-rose-500" : "bg-slate-300 dark:bg-slate-700")
                                )}
                                title={`Parcela ${p.numero}: ${p.quitado ? 'Paga' : (isLate ? 'Atrasada' : 'Pendente')}`}
                              />
                            );
                          })}
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground">{pagas}/{parcs.length}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedContrato(c.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="w-4 h-4 text-primary" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedContrato} onOpenChange={() => setSelectedContrato(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-primary-foreground">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5" /> Gestão Financeira
                </DialogTitle>
                <div className="mt-2 text-primary-foreground/80">
                  <p className="text-sm font-semibold">{contratoSelecionado?.empresa}</p>
                  <p className="text-xs">CONTRATO: {contratoSelecionado?.numero}</p>
                </div>
              </div>
              <Button onClick={handlePrintReport} size="sm" variant="secondary" className="gap-2 shrink-0">
                <Printer className="w-4 h-4" /> Relatório
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-primary-foreground/20">
              <div>
                <p className="text-[10px] uppercase font-bold text-primary-foreground/60 tracking-wider">Valor do Contrato</p>
                <p className="text-lg font-bold">{contratoSelecionado?.valor}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-primary-foreground/60 tracking-wider">Saldo a Pagar</p>
                <p className="text-lg font-bold">
                  {formatCurrency(parcelasContrato.filter(p => !p.quitado).reduce((acc, p) => acc + parseCurrency(p.valor), 0))}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {parcelasContrato.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto opacity-20 mb-3" />
                <p className="italic">Nenhuma parcela localizada para este contrato</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {parcelasContrato.map(p => {
                  const daysLate = calculateDaysLate(p.dataVencimento);
                  const isLate = !p.quitado && daysLate > 0;

                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all",
                        p.quitado
                          ? "bg-emerald-50/30 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 opacity-80"
                          : (isLate ? "bg-rose-50/50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30" : "bg-card border-border")
                      )}
                    >
                      <div className="flex gap-4 items-center">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm",
                          p.quitado ? "bg-emerald-500 text-white" : (isLate ? "bg-rose-500 text-white" : "bg-muted text-muted-foreground")
                        )}>
                          {p.numero}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-mono font-bold text-base">{p.valor}</p>
                            {p.quitado && <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">PAGO</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">Vencimento: {p.dataVencimento}</p>
                          {isLate && (
                            <p className="text-[10px] font-bold text-rose-600 mt-1 uppercase flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {daysLate} dias em atraso
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {p.quitado ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEstornarParcela(p.id)}
                            className="border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/40 text-emerald-700 h-9"
                          >
                            Estornar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleBaixaParcela(p.id)}
                            className={cn(
                              "h-9 px-4 gap-2",
                              isLate ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                            )}
                          >
                            <CheckCircle2 className="w-4 h-4" /> Liquidar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="p-4 bg-muted/30 border-t flex justify-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">IAX Experience Financial Management</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
