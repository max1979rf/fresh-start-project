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
  Search, Eye, Building2, Filter, Printer
} from "lucide-react";
import { motion } from "framer-motion";

// ─── Helpers ────────────────────────────────────────────────
function parseCurrency(val: string): number {
  if (!val) return 0;
  // Handle Brazilian formats: 
  // 1. "27.000,00" -> 27000.00
  // 2. "27.000" -> 27000.00
  // 3. "27,00" -> 27.00
  let cleaned = val.replace(/[^\d,.-]/g, "");

  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Standard BR format: 1.000,00
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    // Only comma: 1000,00 or 27,00
    cleaned = cleaned.replace(",", ".");
  } else if (cleaned.includes(".")) {
    // Only dot: 27.000 (might be thousand sep) or 1000.00 (international)
    // If there are exactly 3 digits after the dot, treat as thousand separator
    const parts = cleaned.split('.');
    if (parts[parts.length - 1].length === 3) {
      cleaned = cleaned.replace(/\./g, "");
    }
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
    </motion.div>
  );
}

// ─── Main ───────────────────────────────────────────────────

export default function Financeiro() {
  const { contratos, parcelas, getParcelasContrato, updateParcela, getSetorNome, addLog, appConfig } = useData();
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

  const handlePrintReport = () => {
    if (!contratoSelecionado) return;

    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) return;

    const companyName = appConfig?.nomeEmpresa || 'Gestão de Contratos';
    const now = new Date().toLocaleString('pt-BR');

    printWin.document.write(`<!DOCTYPE html><html><head><title>Ficha Financeira - ${contratoSelecionado.numero}</title>
    <style>
      body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.5; }
      .header { border-bottom: 2px solid #1a2d5a; padding-bottom: 10px; margin-bottom: 20px; }
      .header h1 { margin: 0; color: #1a2d5a; font-size: 24px; }
      .meta { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
      .meta div p { margin: 4px 0; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f4f4f4; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; font-size: 12px; }
      td { padding: 10px; border-bottom: 1px solid #eee; font-size: 12px; }
      .status-pago { color: green; font-weight: bold; }
      .status-pendente { color: orange; font-weight: bold; }
      .status-atraso { color: red; font-weight: bold; }
      .footer { margin-top: 40px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
    </style></head><body>`);

    printWin.document.write(\`
      <div class="header">
        <h1>Ficha Financeira de Contrato</h1>
        <p style="font-size: 11px; color: #666;">\${companyName} — Gerado em \${now}</p>
      </div>
      <div class="meta">
        <div>
          <p><strong>Contrato Nº:</strong> \${contratoSelecionado.numero}</p>
          <p><strong>Empresa:</strong> \${contratoSelecionado.empresa}</p>
          <p><strong>Objeto:</strong> \${contratoSelecionado.objeto || contratoSelecionado.descricao}</p>
        </div>
        <div>
          <p><strong>Valor Total:</strong> \${contratoSelecionado.valor}</p>
          <p><strong>Vencimento Global:</strong> \${contratoSelecionado.dataVencimento}</p>
          <p><strong>Status Global:</strong> \${contratoSelecionado.status}</p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Nº</th>
            <th>Valor</th>
            <th>Vencimento</th>
            <th>Status</th>
            <th>Atraso</th>
          </tr>
        </thead>
        <tbody>
          \${parcelasContrato.map(p => {
            const isPago = p.status === 'pago' || p.quitado;
            const venc = new Date(p.dataVencimento);
            const isAtrasado = !isPago && venc < new Date();
            let atrasoText = '—';
            if (isAtrasado) {
              const diff = Math.floor((new Date().getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
              atrasoText = diff + ' dias';
            }
            return \`
              <tr>
                <td>\${p.numero}</td>
                <td style="font-family: monospace;">\${p.valor}</td>
                <td>\${p.dataVencimento}</td>
                <td class="\${isPago ? 'status-pago' : isAtrasado ? 'status-atraso' : 'status-pendente'}">
                  \${isPago ? 'PAGO' : isAtrasado ? 'ATRASADO' : 'EM ABERTO'}
                </td>
                <td>\${atrasoText}</td>
              </tr>
            \`;
          }).join('')}
        </tbody>
      </table>
      <div class="footer">
        Este documento é um relatório gerencial do sistema IAX Experience.
      </div>
    \`);
    printWin.document.write('</body></html>');
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 500);
  };

  const cards = [
    { title: "Valor Total Contratos", value: formatCurrency(resumo.valorTotal), icon: DollarSign, color: "text-blue-600" },
    { title: "Total de Prestações", value: resumo.totalParcelas.toString(), icon: FileText, color: "text-slate-600" },
    { title: "Prestações Pagas", value: \`\${resumo.parcelasPagas} (\${formatCurrency(resumo.valorPago)})\`, icon: CheckCircle2, color: "text-emerald-600" },
    { title: "Prestações Pendentes", value: \`\${resumo.parcelasPendentes} (\${formatCurrency(resumo.valorPendente)})\`, icon: AlertTriangle, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground text-sm">Gestão financeira dos contratos — prestações e pagamentos</p>
        </div>
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-mono">
                IAX Experience v1.1
            </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <SummaryCard key={card.title} {...card} delay={i * 0.08} />
        ))}
      </div>

      {/* Filters */}
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
            <SelectTrigger className="w-full sm:w-56 bg-muted/20 border-border/50">
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
            <SelectTrigger className="w-full sm:w-48 bg-muted/20 border-border/50">
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

      {/* Contracts Table */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/50 px-6 py-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Contratos — Visão Financeira
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px]">Nº Contrato</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">V. Prestação</TableHead>
                  <TableHead className="text-center">Parcelas</TableHead>
                  <TableHead className="text-center">Checklist</TableHead>
                  <TableHead>Alertas</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground italic">
                      Nenhum registro financeiro localizado
                    </TableCell>
                  </TableRow>
                ) : (
                  contratosFiltrados.map(c => {
                    const parcs = getParcelasContrato(c.id);
                    const pagas = parcs.filter(p => p.status === "pago" || p.quitado).length;
                    const pendentes = parcs.filter(p => p.status === "pendente" && !p.quitado).length;
                    const qtdPrestacoes = parcs.length || c.qtdPagamentos || 0;
                    const vouchersArr = Array.from({ length: Math.min(qtdPrestacoes, 12) });
                    
                    return (
                      <TableRow key={c.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="font-semibold text-primary">{c.numero}</TableCell>
                        <TableCell className="max-w-[180px] truncate font-medium" title={c.empresa}>{c.empresa}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{getSetorNome(c.idSetor)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{c.valor}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{c.valorPrestacao || "—"}</TableCell>
                        <TableCell className="text-center text-xs">{qtdPrestacoes || "0"}</TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="text-[11px] font-bold text-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                                {pagas}/{qtdPrestacoes}
                            </span>
                            <div className="flex gap-0.5">
                                {vouchersArr.map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={cn(
                                            "w-1.5 h-1.5 rounded-full",
                                            i < pagas ? "bg-emerald-500" : "bg-muted-foreground/30"
                                        )} 
                                    />
                                ))}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {pendentes > 0 ? (
                            <div className="flex items-center gap-1.5 text-destructive font-bold text-[10px] uppercase">
                              <AlertTriangle className="w-3 h-3" />
                              Pendente ({pendentes})
                            </div>
                          ) : parcs.length > 0 ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[10px] uppercase">
                              <CheckCircle2 className="w-3 h-3" />
                              Tudo em dia
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic uppercase">Sem parcelas</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedContrato(c.id)}
                            className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 hover:text-primary transition-all"
                          >
                            <Eye className="w-4 h-4" />
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

      {/* Management Dialog */}
      <Dialog open={!!selectedContrato} onOpenChange={() => setSelectedContrato(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="px-6 py-4 bg-primary text-primary-foreground">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Building2 className="w-6 h-6" />
              Ficha Financeira do Contrato
            </DialogTitle>
            <p className="text-primary-foreground/70 text-sm mt-1">Detalhamento de liquidações e parcelas pendentes</p>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto">
            {contratoSelecionado && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-4 rounded-xl border border-border/50">
                <div className="space-y-1.5 text-sm">
                  <p><span className="text-muted-foreground">Número do Contrato:</span> <strong className="text-foreground">{contratoSelecionado.numero}</strong></p>
                  <p><span className="text-muted-foreground">Empresa Contratada/Nome:</span> <strong className="text-foreground">{contratoSelecionado.empresa}</strong></p>
                  <p><span className="text-muted-foreground">Objeto:</span> <strong className="text-foreground">{contratoSelecionado.objeto || contratoSelecionado.descricao}</strong></p>
                </div>
                <div className="space-y-1.5 text-sm">
                  <p><span className="text-muted-foreground">Valor Global:</span> <strong className="text-primary">{contratoSelecionado.valor}</strong></p>
                  <p><span className="text-muted-foreground">Início — Vencimento:</span> <strong className="text-foreground">{contratoSelecionado.dataInicio} — {contratoSelecionado.dataVencimento}</strong></p>
                  <p><span className="text-muted-foreground">Total Parcelas:</span> <strong className="text-foreground">{parcelasContrato.length}</strong></p>
                </div>
              </div>
            )}

            {/* Detailed summary inside dialog */}
            {parcelasContrato.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="p-3 bg-card border rounded-lg text-center">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground mb-1">Total</p>
                    <p className="text-lg font-black">{parcelasContrato.length}</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-center">
                    <p className="text-[9px] uppercase font-bold text-emerald-800 mb-1">Pagas</p>
                    <p className="text-lg font-black text-emerald-600">{parcelasContrato.filter(p => p.status === "pago" || p.quitado).length}</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-center">
                    <p className="text-[9px] uppercase font-bold text-amber-800 mb-1">Abertas</p>
                    <p className="text-lg font-black text-amber-600">{parcelasContrato.filter(p => p.status === "pendente" && !p.quitado).length}</p>
                </div>
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-center">
                    <p className="text-[9px] uppercase font-bold text-red-800 mb-1">Vencidas</p>
                    <p className="text-lg font-black text-red-600">
                      {parcelasContrato.filter(p => !p.quitado && new Date(p.dataVencimento) < new Date()).length}
                    </p>
                </div>
                <div className="p-3 bg-destructive text-destructive-foreground rounded-lg text-center">
                    <p className="text-[9px] uppercase font-bold mb-1 opacity-70">Soma Atraso</p>
                    <p className="text-lg font-black">
                      {parcelasContrato.reduce((acc, p) => {
                        if (p.quitado) return acc;
                        const v = new Date(p.dataVencimento);
                        if (v < new Date()) {
                          const diff = Math.floor((new Date().getTime() - v.getTime()) / (1000 * 60 * 60 * 24));
                          return acc + diff;
                        }
                        return acc;
                      }, 0)}d
                    </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Listagem de Prestações
              </h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handlePrintReport} className="text-xs h-8">
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Gerar Relatório
                </Button>
                {parcelasContrato.some(p => !p.quitado) && (
                  <Button
                    size="sm"
                    className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                        parcelasContrato.filter(p => !p.quitado).forEach(p => handleBaixaParcela(p.id));
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Liquidar Tudo
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2 pb-4">
              {parcelasContrato.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhuma parcela gerada para este contrato.
                </div>
              ) : (
                parcelasContrato.map(p => {
                  const isPago = p.status === "pago" || p.quitado;
                  const venc = new Date(p.dataVencimento);
                  const isAtrasado = !isPago && venc < new Date();
                  
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border-l-4 transition-all",
                        isPago ? "bg-emerald-50/50 border-l-emerald-500 border-border/50" : 
                        isAtrasado ? "bg-red-50/50 border-l-red-500 border-red-200" : "bg-card border-l-amber-400 border-border"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-black border-2",
                          isPago ? "bg-emerald-100 text-emerald-700 border-emerald-200" : 
                          isAtrasado ? "bg-red-100 text-red-700 border-red-200" : "bg-muted text-muted-foreground border-transparent"
                        )}>
                          {p.numero}
                        </div>
                        <div>
                          <p className="text-base font-bold font-mono">{p.valor}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground font-semibold">Vencimento: {p.dataVencimento}</span>
                            {isAtrasado && (
                              <Badge variant="destructive" className="h-4 text-[9px] px-1 font-bold animate-pulse">
                                {Math.floor((new Date().getTime() - venc.getTime()) / (1000 * 60 * 60 * 24))} dias de atraso
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPago ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => handleEstornarParcela(p.id)}
                          >
                            Estornar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                            onClick={() => handleBaixaParcela(p.id)}
                          >
                            Baixar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
