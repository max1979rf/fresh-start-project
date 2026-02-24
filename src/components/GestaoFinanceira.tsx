import React, { useState, useMemo, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Contrato, Parcela } from "@/types";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2, Clock, AlertTriangle, Printer, Save,
  DollarSign, Percent, XCircle, Undo2, X, Maximize2, Minimize2, ChevronDown, MoreHorizontal
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// ─── Helpers ────────────────────────────────────────────────
function parseCurrency(val: any): number {
  if (typeof val === "number") return val;
  if (!val || typeof val !== "string") return 0;
  let cleaned = val.replace(/[R$ \s]/g, "");
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatCurrency(val: number): string {
  if (isNaN(val)) return "R$ 0,00";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseDateForCompare(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (dateStr.includes("-")) {
    return new Date(dateStr.split("T")[0] + "T00:00:00");
  }
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return "—";
  if (dateStr.includes("/")) return dateStr;
  const d = new Date(dateStr.split("T")[0] + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
}

// ─── Props ──────────────────────────────────────────────────
interface GestaoFinanceiraProps {
  contrato: Contrato;
  open: boolean;
  onClose: () => void;
}

export default function GestaoFinanceira({ contrato, open, onClose }: GestaoFinanceiraProps) {
  const { getParcelasContrato, updateParcela, addLog, appConfig, parcelas } = useData();
  const { currentUser } = useAuth();

  const [multaGlobal, setMultaGlobal] = useState("");
  const [jurosGlobal, setJurosGlobal] = useState("");

  const parcelasList = useMemo(() => {
    return getParcelasContrato(contrato.id).sort((a, b) => a.numero - b.numero);
  }, [contrato.id, getParcelasContrato, parcelas]);

  // Local state for editing multas/juros before saving to DB
  const [extras, setExtras] = useState<Record<string, { multa: number; juros: number }>>({});

  // Sync local extras with DB data when parcelas change or on mount
  React.useEffect(() => {
    const newExtras: Record<string, { multa: number; juros: number }> = {};
    parcelasList.forEach(p => {
      newExtras[p.id] = { multa: p.multa || 0, juros: p.juros || 0 };
    });
    setExtras(newExtras);
  }, [parcelasList]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parcelasVencidas = useMemo(() =>
    parcelasList.filter(p => {
      if (p.quitado) return false;
      const d = parseDateForCompare(p.dataVencimento);
      return d && d < today;
    }), [parcelasList]);

  const parcelasAVencer = useMemo(() =>
    parcelasList.filter(p => {
      if (p.quitado) return false;
      const d = parseDateForCompare(p.dataVencimento);
      return d && d >= today;
    }), [parcelasList]);

  const parcelasPagas = useMemo(() =>
    parcelasList.filter(p => p.quitado), [parcelasList]);

  const [isMinimized, setIsMinimized] = useState(false);

  // Lock body scroll when open
  React.useEffect(() => {
    if (open && !isMinimized) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => document.body.classList.remove("no-scroll");
  }, [open, isMinimized]);

  // Sync multas based on contract's multaPercentual for overdue installments
  React.useEffect(() => {
    if ((contrato.multaPercentual || 0) > 0) {
      const pendingOverdue = parcelasVencidas.filter(p => !p.multa && !p.juros);
      if (pendingOverdue.length > 0) {
        pendingOverdue.forEach(p => {
          const base = parseCurrency(p.valor);
          const calculatedMulta = base * (contrato.multaPercentual! / 100);
          if (calculatedMulta > 0) {
            updateParcela(p.id, { multa: calculatedMulta });
          }
        });
      }
    }
  }, [parcelasVencidas, contrato.multaPercentual, updateParcela]);

  const getExtra = (id: string) => extras[id] || { multa: 0, juros: 0 };

  const setParcelaExtra = useCallback((id: string, field: "multa" | "juros", value: number) => {
    setExtras(prev => ({
      ...prev,
      [id]: { ...getExtra(id), [field]: value }
    }));
    // Auto-save individual change
    const current = getExtra(id);
    updateParcela(id, { [field]: value });
  }, [getExtra, updateParcela]);

  const calcTotal = (p: Parcela) => {
    const base = parseCurrency(p.valor);
    const ex = getExtra(p.id);
    return base + ex.multa + (base * ex.juros / 100);
  };

  const resumo = useMemo(() => {
    let totalPrestacoes = 0, totalPago = 0, totalPendente = 0, totalMultas = 0, totalJuros = 0;
    parcelasList.forEach(p => {
      const base = parseCurrency(p.valor);
      const ex = getExtra(p.id);
      const jurosVal = base * ex.juros / 100;
      totalPrestacoes += base;
      totalMultas += ex.multa;
      totalJuros += jurosVal;
      if (p.quitado) totalPago += base + ex.multa + jurosVal;
      else totalPendente += base + ex.multa + jurosVal;
    });
    return { totalPrestacoes, totalPago, totalPendente, totalMultas, totalJuros, total: totalPrestacoes + totalMultas + totalJuros };
  }, [parcelasList, extras]);

  const handleBaixa = (parcelaId: string) => {
    updateParcela(parcelaId, { status: "pago", quitado: true });
    if (currentUser) {
      addLog(currentUser.id, currentUser.nome, "Baixa Parcela",
        `Parcela quitada no contrato ${contrato.numero}`);
    }
    toast({ title: "Parcela quitada", description: "Prestação marcada como paga." });
  };

  const handleEstorno = (parcelaId: string) => {
    updateParcela(parcelaId, { status: "pendente", quitado: false });
    if (currentUser) {
      addLog(currentUser.id, currentUser.nome, "Estorno Parcela",
        `Parcela estornada no contrato ${contrato.numero}`);
    }
    toast({ title: "Parcela estornada", description: "Prestação voltou para pendente." });
  };

  const handleAplicarMultaGlobal = () => {
    const valor = parseCurrency(multaGlobal);
    if (valor <= 0) return;
    const pendentes = parcelasList.filter(p => !p.quitado);
    setExtras(prev => {
      const updated = { ...prev };
      pendentes.forEach(p => {
        updated[p.id] = { ...(updated[p.id] || { multa: 0, juros: 0 }), multa: valor };
        // Individual auto-save for each
        updateParcela(p.id, { multa: valor });
      });
      return updated;
    });
    toast({ title: "Multa aplicada", description: `Multa de ${formatCurrency(valor)} aplicada em ${pendentes.length} parcelas pendentes.` });
  };

  const handleAplicarJurosGlobal = () => {
    const taxa = parseFloat(jurosGlobal.replace(",", "."));
    if (isNaN(taxa) || taxa <= 0) return;
    const pendentes = parcelasList.filter(p => !p.quitado);
    setExtras(prev => {
      const updated = { ...prev };
      pendentes.forEach(p => {
        updated[p.id] = { ...(updated[p.id] || { multa: 0, juros: 0 }), juros: taxa };
        // Individual auto-save for each
        updateParcela(p.id, { juros: taxa });
      });
      return updated;
    });
    toast({ title: "Juros aplicados", description: `Taxa de ${taxa}% aplicada em ${pendentes.length} parcelas pendentes.` });
  };


  const handlePrintReport = () => {
    const printWin = window.open("", "_blank", "width=900,height=700");
    if (!printWin) return;
    const companyName = appConfig?.nomeEmpresa || "Gestão de Contratos";
    const logoBase64 = appConfig?.logoBase64;
    const now = new Date().toLocaleString("pt-BR");

    const logoHtml = logoBase64
      ? `<div style="text-align:center;margin-bottom:20px"><img src="${logoBase64}" alt="Logo" style="max-height:80px;max-width:250px" /></div>`
      : "";

    let rows = "";
    parcelasList.forEach(p => {
      const ex = getExtra(p.id);
      const base = parseCurrency(p.valor);
      const jurosVal = base * ex.juros / 100;
      const total = base + ex.multa + jurosVal;
      rows += `<tr>
        <td>${p.numero}</td>
        <td>${formatCurrency(base)}</td>
        <td>${formatDateBR(p.dataVencimento)}</td>
        <td>${formatCurrency(ex.multa)}</td>
        <td>${ex.juros.toFixed(2)}%</td>
        <td style="font-weight:bold">${formatCurrency(total)}</td>
        <td><span style="color:${p.quitado ? "green" : "red"};font-weight:bold">${p.quitado ? "PAGO" : "PENDENTE"}</span></td>
      </tr>`;
    });

    printWin.document.write(`<html><head><title>Ficha Financeira - ${contrato.numero}</title>
      <style>
        body{font-family:'Segoe UI',sans-serif;padding:30px;color:#333}
        h1{font-size:18px;margin:0}h2{font-size:14px;color:#666;margin:4px 0 20px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th{background:#f1f5f9;padding:10px 8px;text-align:left;font-size:12px;border-bottom:2px solid #e2e8f0}
        td{padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px}
        .summary{display:flex;gap:24px;margin:16px 0;flex-wrap:wrap}
        .summary-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;min-width:140px}
        .summary-item .label{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:600}
        .summary-item .value{font-size:16px;font-weight:700;margin-top:4px}
        .footer{margin-top:30px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}
      </style></head><body>`);
    printWin.document.write(logoHtml);
    printWin.document.write(`<h1>Ficha Financeira — Contrato: ${contrato.numero}</h1>`);
    printWin.document.write(`<h2>${contrato.empresa} | ${contrato.descricao}</h2>`);
    printWin.document.write(`<div class="summary">
      <div class="summary-item"><div class="label">Total Prestações</div><div class="value">${formatCurrency(resumo.totalPrestacoes)}</div></div>
      <div class="summary-item"><div class="label">Total Multas</div><div class="value">${formatCurrency(resumo.totalMultas)}</div></div>
      <div class="summary-item"><div class="label">Total Juros</div><div class="value">${formatCurrency(resumo.totalJuros)}</div></div>
      <div class="summary-item"><div class="label">Total Geral</div><div class="value" style="color:#0f766e">${formatCurrency(resumo.total)}</div></div>
      <div class="summary-item"><div class="label">Pago</div><div class="value" style="color:#16a34a">${formatCurrency(resumo.totalPago)}</div></div>
      <div class="summary-item"><div class="label">Pendente</div><div class="value" style="color:#dc2626">${formatCurrency(resumo.totalPendente)}</div></div>
    </div>`);
    printWin.document.write(`<table><thead><tr><th>Nº</th><th>Valor</th><th>Vencimento</th><th>Multa</th><th>Juros</th><th>Total</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
    printWin.document.write(`<div class="footer">Relatório gerado em ${now} — ${companyName}</div>`);
    printWin.document.write(`</body></html>`);
    printWin.document.close();
    printWin.print();
  };

  // ─── Render parcela row ───────────────────────────────────
  const renderParcelaRow = (p: Parcela, showActions = true) => {
    const ex = getExtra(p.id);
    const base = parseCurrency(p.valor);
    const jurosVal = base * ex.juros / 100;
    const total = base + ex.multa + jurosVal;
    const venc = parseDateForCompare(p.dataVencimento);
    const isVencida = venc && venc < today && !p.quitado;

    return (
      <TableRow key={p.id} className={cn(isVencida && "bg-destructive/5")}>
        <TableCell>
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center font-bold text-xs">
            {p.numero}
          </div>
        </TableCell>
        <TableCell className="font-mono text-sm">{formatCurrency(base)}</TableCell>
        <TableCell className="text-sm">
          <span className={cn(isVencida && "text-destructive font-semibold")}>
            {formatDateBR(p.dataVencimento)}
          </span>
        </TableCell>
        <TableCell>
          {!p.quitado ? (
            <Input
              type="text"
              placeholder="0,00"
              value={ex.multa > 0 ? ex.multa.toString().replace(".", ",") : ""}
              onChange={e => setParcelaExtra(p.id, "multa", parseCurrency(e.target.value))}
              className="w-24 h-8 text-xs"
            />
          ) : (
            <span className="text-xs text-muted-foreground">{formatCurrency(ex.multa)}</span>
          )}
        </TableCell>
        <TableCell>
          {!p.quitado ? (
            <div className="flex items-center gap-1">
              <Input
                type="text"
                placeholder="0,00"
                value={ex.juros > 0 ? ex.juros.toString().replace(".", ",") : ""}
                onChange={e => setParcelaExtra(p.id, "juros", parseFloat(e.target.value.replace(",", ".")) || 0)}
                className="w-20 h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{ex.juros.toFixed(2)}%</span>
          )}
        </TableCell>
        <TableCell className="font-mono font-bold text-sm">{formatCurrency(total)}</TableCell>
        <TableCell>
          {p.quitado ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Pago
            </Badge>
          ) : isVencida ? (
            <Badge variant="destructive">
              <XCircle className="w-3 h-3 mr-1" /> Vencida
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              <Clock className="w-3 h-3 mr-1" /> A Vencer
            </Badge>
          )}
        </TableCell>
        {showActions && (
          <TableCell>
            <Button
              size="sm"
              variant={p.quitado ? "outline" : "default"}
              onClick={() => p.quitado ? handleEstorno(p.id) : handleBaixa(p.id)}
              className={cn("h-7 text-xs", !p.quitado && "bg-emerald-600 hover:bg-emerald-700")}
            >
              {p.quitado ? (
                <><Undo2 className="w-3 h-3 mr-1" /> Estornar</>
              ) : (
                <><CheckCircle2 className="w-3 h-3 mr-1" /> Liquidar</>
              )}
            </Button>
          </TableCell>
        )}
      </TableRow>
    );
  };

  // ─── Render mobile card ───────────────────────────────────
  const renderParcelaCard = (p: Parcela) => {
    const ex = getExtra(p.id);
    const base = parseCurrency(p.valor);
    const jurosVal = base * ex.juros / 100;
    const total = base + ex.multa + jurosVal;
    const venc = parseDateForCompare(p.dataVencimento);
    const isVencida = venc && venc < today && !p.quitado;

    return (
      <Card key={p.id} className={cn("overflow-hidden border-l-4",
        p.quitado ? "border-l-emerald-500" : isVencida ? "border-l-destructive" : "border-l-amber-500")}>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-muted-foreground">#{p.numero}</span>
              <Badge variant={p.quitado ? "outline" : isVencida ? "destructive" : "outline"}
                className={cn(p.quitado && "text-emerald-700 bg-emerald-50 border-emerald-200",
                  !p.quitado && !isVencida && "text-amber-700 bg-amber-50 border-amber-200")}>
                {p.quitado ? "Pago" : isVencida ? "Vencida" : "A Vencer"}
              </Badge>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => p.quitado ? handleEstorno(p.id) : handleBaixa(p.id)}>
                  {p.quitado ? <><Undo2 className="w-4 h-4 mr-2" /> Estornar</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Liquidar</>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor / Vencimento</p>
              <p className="font-semibold text-sm">{formatCurrency(base)}</p>
              <p className={cn("text-xs", isVencida && "text-destructive font-bold")}>{formatDateBR(p.dataVencimento)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Total</p>
              <p className="font-bold text-sm text-primary">{formatCurrency(total)}</p>
            </div>
          </div>

          <Separator className="opacity-50" />

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Multa (R$)</Label>
              <Input
                type="text"
                disabled={p.quitado}
                value={ex.multa > 0 ? ex.multa.toString().replace(".", ",") : ""}
                onChange={e => setParcelaExtra(p.id, "multa", parseCurrency(e.target.value))}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Juros (%)</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="text"
                  disabled={p.quitado}
                  value={ex.juros > 0 ? ex.juros.toString().replace(".", ",") : ""}
                  onChange={e => setParcelaExtra(p.id, "juros", parseFloat(e.target.value.replace(",", ".")) || 0)}
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!open) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={isMinimized ? {
          opacity: 1,
          scale: 0.3,
          x: "calc(50vw - 120px)",
          y: "calc(50vh - 60px)",
          borderRadius: "1rem"
        } : {
          opacity: 1,
          scale: 1,
          x: 0,
          y: 0,
          borderRadius: 0
        }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={cn(
          "fixed top-0 left-0 w-screen h-screen z-[100] bg-background flex flex-col shadow-2xl",
          isMinimized && "cursor-pointer overflow-hidden border-4 border-primary/20 hover:border-primary/50"
        )}
        onClick={() => isMinimized && setIsMinimized(false)}
      >
        {/* HEADER FIXO */}
        <header className="shrink-0 bg-card border-b z-20">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-playfair flex items-center gap-2 leading-tight">
                  Gestão Financeira <span className="text-muted-foreground font-normal text-sm font-sans">— {contrato.numero}</span>
                </h1>
                <p className="text-xs text-muted-foreground truncate max-w-[400px]">
                  {contrato.empresa}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                title={isMinimized ? "Expandir" : "Minimizar"}
              >
                {isMinimized ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <div className="p-4 space-y-4 bg-muted/20">
              <div className="flex flex-wrap gap-4 items-end">
                <Card className="flex-1 min-w-[300px] border-dashed">
                  <CardContent className="p-3">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Aplicar em todas as parcelas pendentes
                    </p>
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase">Multa (R$)</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Ex: 50,00"
                            value={multaGlobal}
                            onChange={e => setMultaGlobal(e.target.value)}
                            className="w-28 h-8 text-sm"
                          />
                          <Button size="sm" variant="outline" onClick={handleAplicarMultaGlobal} className="h-8">
                            Aplicar
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-semibold">Juros (%)</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Ex: 2,00"
                            value={jurosGlobal}
                            onChange={e => setJurosGlobal(e.target.value)}
                            className="w-24 h-8 text-sm"
                          />
                          <Button size="sm" variant="outline" onClick={handleAplicarJurosGlobal} className="h-8">
                            Aplicar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Status Cards - Desktop Only */}
                <div className="hidden lg:grid grid-cols-4 gap-2 flex-[1.5]">
                  <MiniCard label="Total" value={parcelasList.length.toString()} icon={<DollarSign className="w-3 h-3" />} />
                  <MiniCard label="Pagas" value={parcelasPagas.length.toString()} icon={<CheckCircle2 className="w-3 h-3 text-emerald-600" />} />
                  <MiniCard label="Vencidas" value={parcelasVencidas.length.toString()} icon={<XCircle className="w-3 h-3 text-destructive" />} accent={parcelasVencidas.length > 0 ? "destructive" : undefined} />
                  <MiniCard label="A Vencer" value={parcelasAVencer.length.toString()} icon={<Clock className="w-3 h-3 text-amber-500" />} />
                </div>
              </div>

              <Tabs defaultValue="todas" className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:max-w-md h-9">
                  <TabsTrigger value="todas" className="text-xs">Todas</TabsTrigger>
                  <TabsTrigger value="vencidas" className="text-xs text-destructive">Vencidas</TabsTrigger>
                  <TabsTrigger value="avencer" className="text-xs">A Vencer</TabsTrigger>
                  <TabsTrigger value="pagas" className="text-xs text-emerald-600">Pagas</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </header>

        {/* CORPO SCROLLÁVEL */}
        <main className={cn(
          "flex-1 overflow-y-auto p-4 lg:p-6 bg-muted/5",
          isMinimized && "hidden"
        )}>
          <Tabs defaultValue="todas">
            {(["todas", "vencidas", "avencer", "pagas"] as const).map(tab => {
              const list = tab === "todas" ? parcelasList
                : tab === "vencidas" ? parcelasVencidas
                  : tab === "avencer" ? parcelasAVencer
                    : parcelasPagas;
              return (
                <TabsContent key={tab} value={tab} className="m-0">
                  {list.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-in fade-in zoom-in duration-300">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Clock className="w-8 h-8 opacity-20" />
                      </div>
                      <p className="italic text-sm">Nenhuma parcela nesta categoria.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {/* Desktop Table */}
                      <div className="hidden md:block bg-card border rounded-xl overflow-hidden shadow-sm">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead className="w-16 font-bold text-[10px] uppercase">Nº</TableHead>
                              <TableHead className="font-bold text-[10px] uppercase">Valor Base</TableHead>
                              <TableHead className="font-bold text-[10px] uppercase">Vencimento</TableHead>
                              <TableHead className="font-bold text-[10px] uppercase">Multas (R$)</TableHead>
                              <TableHead className="font-bold text-[10px] uppercase">Juros (%)</TableHead>
                              <TableHead className="font-bold text-[10px] uppercase">Total Parcela</TableHead>
                              <TableHead className="font-bold text-[10px] uppercase">Status</TableHead>
                              <TableHead className="w-32 text-right font-bold text-[10px] uppercase">Ação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {list.map(p => renderParcelaRow(p))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile Cards */}
                      <div className="grid grid-cols-1 gap-3 md:hidden">
                        {list.map(p => renderParcelaCard(p))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </main>

        {/* RODAPÉ FIXO */}
        <footer className={cn(
          "shrink-0 bg-card border-t p-4 lg:p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]",
          isMinimized && "hidden"
        )}>
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 w-full md:w-auto">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Subtotal Prestações
                </p>
                <p className="font-mono font-bold text-lg">{formatCurrency(resumo.totalPrestacoes)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Total Pago
                </p>
                <p className="font-mono font-bold text-lg text-emerald-600">{formatCurrency(resumo.totalPago)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1 text-destructive">
                  <Clock className="w-3 h-3" /> Total Pendente
                </p>
                <p className="font-mono font-bold text-lg text-destructive">{formatCurrency(resumo.totalPendente)}</p>
              </div>
              <div className="space-y-1 bg-primary/5 p-2 px-4 rounded-lg border border-primary/10">
                <p className="text-[10px] uppercase font-bold text-primary flex items-center gap-1">
                  Total Geral (+Multas/Juros)
                </p>
                <p className="font-mono font-bold text-2xl text-primary">{formatCurrency(resumo.total)}</p>
              </div>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <Button variant="outline" onClick={handlePrintReport} className="flex-1 md:flex-none border-primary/20 hover:bg-primary/5">
                <Printer className="w-4 h-4 mr-2" /> Gerar Relatório Completo
              </Button>
            </div>
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

// ─── MiniCard ───────────────────────────────────────────────
function MiniCard({ label, value, icon, accent }: {
  label: string; value: string; icon: React.ReactNode; accent?: "destructive" | "primary";
}) {
  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-1 bg-card",
      accent === "destructive" && "border-destructive/30 bg-destructive/5",
      accent === "primary" && "border-primary/30 bg-primary/5",
    )}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase font-semibold">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
