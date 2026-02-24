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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DollarSign, FileText, CheckCircle2, Clock, AlertTriangle,
  Search, Eye, Building2, Filter, Printer
} from "lucide-react";
import GestaoFinanceira from "@/components/GestaoFinanceira";

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
  const { contratos = [], parcelas = [], getParcelasContrato, updateParcela, getSetorNome, addLog, appConfig } = useData() || {};
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

      <Card>
        <CardContent className="p-4 flex gap-4 overflow-x-auto">
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {empresasUnicas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="vigente">Vigente</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nº</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-center">Checklist</TableHead>
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(contratosFiltrados || []).map(c => {
            const parcs = getParcelasContrato ? getParcelasContrato(c.id) : [];
            const pagas = parcs.filter(p => p.quitado).length;
            return (
              <TableRow key={c.id}>
                <TableCell className="font-bold">{c.numero}</TableCell>
                <TableCell className="max-w-[200px] truncate">{c.empresa}</TableCell>
                <TableCell className="text-right font-mono">{c.valor}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{pagas}/{parcs.length}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedContrato(c.id)}><Eye className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {contratoSelecionado && (
        <GestaoFinanceira
          contrato={contratoSelecionado}
          open={!!selectedContrato}
          onClose={() => setSelectedContrato(null)}
        />
      )}
    </div>
  );
}
