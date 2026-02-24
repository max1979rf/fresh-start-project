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
  DollarSign, Percent, XCircle, Undo2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

// ─── Local storage for multa/juros per parcela ──────────────
const STORAGE_KEY = "parcelas_extras";

interface ParcelaExtras {
  multa: number;
  juros: number;
}

function loadExtras(): Record<string, ParcelaExtras> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveExtras(data: Record<string, ParcelaExtras>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

  const [extras, setExtras] = useState<Record<string, ParcelaExtras>>(loadExtras);
  const [multaGlobal, setMultaGlobal] = useState("");
  const [jurosGlobal, setJurosGlobal] = useState("");

  const parcelasList = useMemo(() => {
    return getParcelasContrato(contrato.id).sort((a, b) => a.numero - b.numero);
  }, [contrato.id, getParcelasContrato, parcelas]);

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

  const getExtra = (id: string): ParcelaExtras => extras[id] || { multa: 0, juros: 0 };

  const setParcelaExtra = useCallback((id: string, field: "multa" | "juros", value: number) => {
    setExtras(prev => {
      const updated = { ...prev, [id]: { ...getExtra(id), ...prev[id], [field]: value } };
      saveExtras(updated);
      return updated;
    });
  }, []);

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
      });
      saveExtras(updated);
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
      });
      saveExtras(updated);
      return updated;
    });
    toast({ title: "Juros aplicados", description: `Taxa de ${taxa}% aplicada em ${pendentes.length} parcelas pendentes.` });
  };

  const handleSalvar = () => {
    saveExtras(extras);
    if (currentUser) {
      addLog(currentUser.id, currentUser.nome, "Salvar Financeiro",
        `Dados financeiros salvos para contrato ${contrato.numero}`);
    }
    toast({ title: "Dados salvos", description: "Informações financeiras salvas com sucesso." });
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

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Gestão Financeira — {contrato.numero}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Info do contrato */}
          <div className="bg-muted/50 p-3 rounded-lg flex flex-wrap gap-4 justify-between items-center text-sm">
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Empresa</p>
              <p className="font-semibold">{contrato.empresa}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor Contrato</p>
              <p className="font-semibold font-mono">{contrato.valor}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Vigência</p>
              <p className="font-semibold">{formatDateBR(contrato.dataInicio)} → {formatDateBR(contrato.dataVencimento)}</p>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MiniCard label="Total Prestações" value={parcelasList.length.toString()} icon={<DollarSign className="w-4 h-4" />} />
            <MiniCard label="Pagas" value={parcelasPagas.length.toString()} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} />
            <MiniCard label="Vencidas" value={parcelasVencidas.length.toString()} icon={<XCircle className="w-4 h-4 text-destructive" />} accent={parcelasVencidas.length > 0 ? "destructive" : undefined} />
            <MiniCard label="A Vencer" value={parcelasAVencer.length.toString()} icon={<Clock className="w-4 h-4 text-amber-500" />} />
            <MiniCard label="Total Multas" value={formatCurrency(resumo.totalMultas)} icon={<AlertTriangle className="w-4 h-4 text-orange-500" />} />
            <MiniCard label="Total Geral" value={formatCurrency(resumo.total)} icon={<DollarSign className="w-4 h-4 text-primary" />} accent="primary" />
          </div>

          {/* Aplicar multa/juros global */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase font-bold text-muted-foreground mb-3">Aplicar em todas as parcelas pendentes</p>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Multa (R$)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: 50,00"
                      value={multaGlobal}
                      onChange={e => setMultaGlobal(e.target.value)}
                      className="w-32 h-8 text-sm"
                    />
                    <Button size="sm" variant="outline" onClick={handleAplicarMultaGlobal} className="h-8">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Aplicar Multa
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Taxa de Juros (%)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: 2,00"
                      value={jurosGlobal}
                      onChange={e => setJurosGlobal(e.target.value)}
                      className="w-32 h-8 text-sm"
                    />
                    <Button size="sm" variant="outline" onClick={handleAplicarJurosGlobal} className="h-8">
                      <Percent className="w-3 h-3 mr-1" /> Aplicar Juros
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="todas" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="todas">Todas ({parcelasList.length})</TabsTrigger>
              <TabsTrigger value="vencidas" className="text-destructive">Vencidas ({parcelasVencidas.length})</TabsTrigger>
              <TabsTrigger value="avencer">A Vencer ({parcelasAVencer.length})</TabsTrigger>
              <TabsTrigger value="pagas">Pagas ({parcelasPagas.length})</TabsTrigger>
            </TabsList>

            {(["todas", "vencidas", "avencer", "pagas"] as const).map(tab => {
              const list = tab === "todas" ? parcelasList
                : tab === "vencidas" ? parcelasVencidas
                : tab === "avencer" ? parcelasAVencer
                : parcelasPagas;
              return (
                <TabsContent key={tab} value={tab}>
                  {list.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground italic text-sm">Nenhuma parcela nesta categoria.</p>
                  ) : (
                    <div className="border rounded-lg overflow-auto max-h-[40vh]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Nº</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Multa</TableHead>
                            <TableHead>Juros</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-28">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {list.map(p => renderParcelaRow(p))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>

          {/* Resumo financeiro */}
          <Card>
            <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor Prestações</p>
                <p className="font-mono font-bold">{formatCurrency(resumo.totalPrestacoes)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">+ Multas</p>
                <p className="font-mono font-bold text-orange-600">{formatCurrency(resumo.totalMultas)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">+ Juros</p>
                <p className="font-mono font-bold text-amber-600">{formatCurrency(resumo.totalJuros)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Pago</p>
                <p className="font-mono font-bold text-emerald-600">{formatCurrency(resumo.totalPago)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Pendente</p>
                <p className="font-mono font-bold text-destructive">{formatCurrency(resumo.totalPendente)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Geral (Prestação + Multa + Juros)</p>
                <p className="font-mono font-bold text-lg text-primary">{formatCurrency(resumo.total)}</p>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Action buttons */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={handlePrintReport}>
              <Printer className="w-4 h-4 mr-2" /> Relatório
            </Button>
            <Button onClick={handleSalvar} className="bg-primary">
              <Save className="w-4 h-4 mr-2" /> Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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
