import { useState, useRef, useCallback, useEffect } from "react";
import { extractTextFromFile } from '../utils/pdfAnalyzer';
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  Settings, Upload, Save, Check, AlertCircle, X, Image, Link2, Bell,
  Trash2, Brain, Key, Copy, RefreshCw, CheckCircle2, Shield, Code, Loader2,
  Mail, Power, ChevronDown, ChevronUp, Coins, Cloud, CloudOff, Bot
} from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import type { AppConfig } from "../types";
import { callLlmApi } from "../utils/llmService";

// --- Generate random keys ---
function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "lwp_";
  for (let i = 0; i < 40; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}

function generateEmpresaId(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `EMP${num}`;
}
// --- LLM provider info + models ---
const LLM_PROVIDERS = [
  {
    value: "openai", label: "OpenAI (GPT)", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini",
    models: [
      { value: "gpt-4o", label: "GPT-4o (mais capaz)" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini (rápido e econômico)" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-4", label: "GPT-4" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
      { value: "o1", label: "o1 (raciocínio avançado)" },
      { value: "o1-mini", label: "o1 Mini" },
      { value: "o1-preview", label: "o1 Preview" },
      { value: "o3-mini", label: "o3 Mini (novo)" },
    ]
  },
  {
    value: "anthropic", label: "Anthropic (Claude)", baseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-3-5-sonnet-20241022",
    models: [
      { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (recomendado)" },
      { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (rápido)" },
      { value: "claude-3-opus-20240229", label: "Claude 3 Opus (mais poderoso)" },
      { value: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet" },
      { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
    ]
  },
  {
    value: "google", label: "Google (Gemini)", baseUrl: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-2.0-flash",
    models: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (novo)" },
      { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
      { value: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash 8B" },
    ]
  },
  {
    value: "meta", label: "Meta (Llama)", baseUrl: "", defaultModel: "llama-3.3-70b",
    models: [
      { value: "llama-3.3-70b", label: "Llama 3.3 70B" },
      { value: "llama-3.2-90b-vision", label: "Llama 3.2 90B Vision" },
      { value: "llama-3.2-11b-vision", label: "Llama 3.2 11B Vision" },
      { value: "llama-3.1-405b", label: "Llama 3.1 405B (maior)" },
      { value: "llama-3.1-70b", label: "Llama 3.1 70B" },
      { value: "llama-3.1-8b", label: "Llama 3.1 8B" },
    ]
  },
  {
    value: "mistral", label: "Mistral AI", baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-large-latest",
    models: [
      { value: "mistral-large-latest", label: "Mistral Large (mais capaz)" },
      { value: "mistral-medium-latest", label: "Mistral Medium" },
      { value: "mistral-small-latest", label: "Mistral Small" },
      { value: "open-mistral-nemo", label: "Mistral Nemo (aberto)" },
      { value: "codestral-latest", label: "Codestral (código)" },
      { value: "mixtral-8x7b", label: "Mixtral 8x7B" },
      { value: "mixtral-8x22b", label: "Mixtral 8x22B" },
    ]
  },
  {
    value: "cohere", label: "Cohere", baseUrl: "https://api.cohere.ai/v1", defaultModel: "command-r-plus",
    models: [
      { value: "command-r-plus", label: "Command R+ (mais capaz)" },
      { value: "command-r", label: "Command R" },
      { value: "command-light", label: "Command Light" },
      { value: "command", label: "Command" },
    ]
  },
  {
    value: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat",
    models: [
      { value: "deepseek-chat", label: "DeepSeek Chat (V3)" },
      { value: "deepseek-reasoner", label: "DeepSeek Reasoner (R1)" },
      { value: "deepseek-coder", label: "DeepSeek Coder" },
    ]
  },
  {
    value: "groq", label: "Groq (Velocidade)", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile",
    models: [
      { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
      { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
      { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
      { value: "gemma2-9b-it", label: "Gemma 2 9B" },
    ]
  },
  {
    value: "perplexity", label: "Perplexity", baseUrl: "https://api.perplexity.ai", defaultModel: "sonar-pro",
    models: [
      { value: "sonar-pro", label: "Sonar Pro (busca + IA)" },
      { value: "sonar", label: "Sonar" },
      { value: "sonar-reasoning-pro", label: "Sonar Reasoning Pro" },
      { value: "sonar-reasoning", label: "Sonar Reasoning" },
    ]
  },
  {
    value: "xai", label: "xAI (Grok)", baseUrl: "https://api.x.ai/v1", defaultModel: "grok-2",
    models: [
      { value: "grok-2", label: "Grok 2" },
      { value: "grok-2-mini", label: "Grok 2 Mini" },
      { value: "grok-beta", label: "Grok Beta" },
    ]
  },
  {
    value: "gptmaker", label: "GPTMaker", baseUrl: "", defaultModel: "",
    models: []
  },
  {
    value: "custom", label: "Outro (Custom)", baseUrl: "", defaultModel: "",
    models: []
  },
] as const;

// --- API Endpoints doc (detailed) ---
const API_ENDPOINTS = [
  {
    method: "POST", path: "/api/v1/contratos/novo", desc: "Criar novo contrato",
    description: "Cria um novo contrato no sistema com base em um modelo existente ou com dados personalizados. O contrato é automaticamente registrado na auditoria.",
    headers: 'Authorization: Bearer {API_KEY}\nContent-Type: application/json',
    requestBody: `{\n  "empresa_id": "{EMPRESA_ID}",\n  "modelo_id": "12345",\n  "dados": {\n    "parte_contratada": "Empresa XYZ",\n    "valor": "50000",\n    "prazo": "12 meses",\n    "objeto": "Prestação de serviços de TI",\n    "data_inicio": "2026-03-01"\n  }\n}`,
    responseBody: `{\n  "success": true,\n  "contrato_id": "cnt_abc123",\n  "numero": "FAP-2026-0042",\n  "status": "Vigente",\n  "criado_em": "2026-02-14T19:00:00Z"\n}`,
    statusCodes: ["201 Created — Contrato criado com sucesso", "400 Bad Request — Dados inválidos", "401 Unauthorized — API Key inválida", "422 Unprocessable — Modelo não encontrado"]
  },
  {
    method: "GET", path: "/api/v1/contratos/{contrato_id}", desc: "Consultar contrato",
    description: "Retorna os dados completos de um contrato específico, incluindo status, valores, partes envolvidas e histórico.",
    headers: 'Authorization: Bearer {API_KEY}',
    requestBody: null,
    responseBody: `{\n  "contrato_id": "cnt_abc123",\n  "numero": "FAP-2026-0042",\n  "empresa": "Empresa XYZ",\n  "objeto": "Prestação de serviços de TI",\n  "valor": "R$ 50.000,00",\n  "status": "Vigente",\n  "data_inicio": "2026-03-01",\n  "data_vencimento": "2027-03-01",\n  "setor": "Tecnologia",\n  "criado_por": "admin",\n  "criado_em": "2026-02-14T19:00:00Z"\n}`,
    statusCodes: ["200 OK — Contrato encontrado", "401 Unauthorized — API Key inválida", "404 Not Found — Contrato não encontrado"]
  },
  {
    method: "POST", path: "/api/v1/modelos/upload", desc: "Upload de modelo de contrato",
    description: "Faz upload de um modelo de contrato em PDF. O sistema analisa o documento via IA, detecta o tipo e extrai a estrutura para reutilização.",
    headers: 'Authorization: Bearer {API_KEY}\nContent-Type: multipart/form-data',
    requestBody: `{\n  "empresa_id": "{EMPRESA_ID}",\n  "arquivo": "(arquivo PDF em multipart)",\n  "nome": "Contrato Padrão de Serviços",\n  "tipo": "Serviço",\n  "tags": ["serviço", "SLA", "terceirização"]\n}`,
    responseBody: `{\n  "success": true,\n  "modelo_id": "mdl_xyz789",\n  "nome": "Contrato Padrão de Serviços",\n  "tipo_detectado": "Serviço",\n  "campos_extraidos": ["NUMERO", "EMPRESA", "VALOR", "PRAZO"],\n  "criado_em": "2026-02-14T19:00:00Z"\n}`,
    statusCodes: ["201 Created — Modelo criado", "400 Bad Request — Arquivo inválido", "401 Unauthorized — API Key inválida", "413 Payload Too Large — Arquivo excede o limite"]
  },
  {
    method: "GET", path: "/api/v1/modelos", desc: "Listar modelos disponíveis",
    description: "Retorna a lista de todos os modelos de contrato disponíveis para a empresa, incluindo nome, tipo, tags e data de criação.",
    headers: 'Authorization: Bearer {API_KEY}',
    requestBody: null,
    responseBody: `{\n  "total": 6,\n  "modelos": [\n    {\n      "modelo_id": "mdl_001",\n      "nome": "Contrato de Prestação de Serviços",\n      "tipo": "Serviço",\n      "tags": ["serviço", "SLA"],\n      "criado_em": "2026-01-15"\n    },\n    {\n      "modelo_id": "mdl_002",\n      "nome": "Contrato de Fornecimento",\n      "tipo": "Fornecimento",\n      "tags": ["materiais", "compra"],\n      "criado_em": "2026-01-20"\n    }\n  ]\n}`,
    statusCodes: ["200 OK — Lista retornada com sucesso", "401 Unauthorized — API Key inválida"]
  },
  {
    method: "POST", path: "/api/v1/empresa/registrar", desc: "Registrar nova empresa",
    description: "Registra uma nova empresa contratante no sistema e gera automaticamente um ID único e uma chave de API exclusiva para autenticação.",
    headers: 'Content-Type: application/json',
    requestBody: `{\n  "nome_empresa": "Minha Empresa Ltda",\n  "email": "contato@minhaempresa.com",\n  "cnpj": "12.345.678/0001-90"\n}`,
    responseBody: `{\n  "success": true,\n  "empresa_id": "EMP492817",\n  "api_key": "lwp_xK9mN2pQrS...",\n  "criado_em": "2026-02-14T19:00:00Z",\n  "mensagem": "Guarde sua API Key com segurança. Ela não será exibida novamente."\n}`,
    statusCodes: ["201 Created — Empresa registrada", "400 Bad Request — Dados incompletos", "409 Conflict — CNPJ já registrado"]
  },
];

type EndpointDoc = typeof API_ENDPOINTS[number];

export default function Configuracoes() {
  const { appConfig, setAppConfig, addLog, setores, addAlerta, alertas, loading } = useData();
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Identity ---
  const [nomeEmpresa, setNomeEmpresa] = useState(appConfig.nomeEmpresa || "");
  const [alertaEmailAtivo, setAlertaEmailAtivo] = useState(appConfig.alertaEmailAtivo || false);
  const [alertasAtivos, setAlertasAtivos] = useState(appConfig.alertasAtivos !== false); // default true
  const [emailsSetor, setEmailsSetor] = useState<Record<string, string>>(appConfig.emailsAlertaSetor || {});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEndpoint, setExpandedEndpoint] = useState<number | null>(null);

  // --- Webhooks ---
  const [webhookGptMaker, setWebhookGptMaker] = useState(appConfig.webhookGptMaker || "");
  const [webhookN8n, setWebhookN8n] = useState(appConfig.webhookN8n || "");
  const [gptMakerAgentId, setGptMakerAgentId] = useState(appConfig.gptMakerAgentId || "");
  const [gptMakerApiKey, setGptMakerApiKey] = useState(appConfig.gptMakerApiKey || "");

  // --- LLM (RF01) ---
  const [llmProvider, setLlmProvider] = useState<'openai' | 'anthropic' | 'google' | 'meta' | 'mistral' | 'cohere' | 'deepseek' | 'groq' | 'perplexity' | 'xai' | 'gptmaker' | 'custom'>(appConfig.llmProvider || "openai");
  const [llmApiKey, setLlmApiKey] = useState(appConfig.llmApiKey || "");
  const [llmModel, setLlmModel] = useState(appConfig.llmModel || "gpt-4o-mini");
  const [llmBaseUrl, setLlmBaseUrl] = useState(appConfig.llmBaseUrl || "");
  const [llmStatus, setLlmStatus] = useState<"connected" | "disconnected" | "error">(
    appConfig.llmStatus || "disconnected"
  );
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmCustomPrompt, setLlmCustomPrompt] = useState(appConfig.llmCustomPrompt || "");
  const [llmKnowledgeBase, setLlmKnowledgeBase] = useState(appConfig.llmKnowledgeBase || "");
  const [llmTone, setLlmTone] = useState<'formal' | 'informal' | 'tecnico'>(appConfig.llmTone || "formal");
  const [llmSpecialization, setLlmSpecialization] = useState(appConfig.llmSpecialization || "Geral");
  const [llmExamples, setLlmExamples] = useState<{ user: string; assistant: string }[]>(appConfig.llmExamples || []);
  const [trainingCollapsed, setTrainingCollapsed] = useState(false);
  const [llmTemperature, setLlmTemperature] = useState(appConfig.llmTemperature ?? 0.7);
  const [llmTopP, setLlmTopP] = useState(appConfig.llmTopP ?? 1);
  const [llmFrequencyPenalty, setLlmFrequencyPenalty] = useState(appConfig.llmFrequencyPenalty ?? 0);
  const [llmPresencePenalty, setLlmPresencePenalty] = useState(appConfig.llmPresencePenalty ?? 0);
  const [gptMakerTesting, setGptMakerTesting] = useState(false);
  const [gptMakerTestResult, setGptMakerTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // --- Sync local state once Supabase data is loaded ---
  // useState() captures values at component mount — BEFORE the async fetch from Supabase
  // completes, so all fields initialize as empty. This effect runs once when `loading`
  // transitions to false and backfills every local field with the persisted values.
  const configSyncedRef = useRef(false);
  useEffect(() => {
    if (loading || configSyncedRef.current) return;
    configSyncedRef.current = true;

    setNomeEmpresa(appConfig.nomeEmpresa || "");
    setAlertaEmailAtivo(appConfig.alertaEmailAtivo ?? false);
    setAlertasAtivos(appConfig.alertasAtivos !== false);
    setEmailsSetor(appConfig.emailsAlertaSetor || {});
    setWebhookGptMaker(appConfig.webhookGptMaker || "");
    setWebhookN8n(appConfig.webhookN8n || "");
    setGptMakerAgentId(appConfig.gptMakerAgentId || "");
    setGptMakerApiKey(appConfig.gptMakerApiKey || "");
    if (appConfig.llmProvider) setLlmProvider(appConfig.llmProvider);
    setLlmApiKey(appConfig.llmApiKey || "");
    setLlmModel(appConfig.llmModel || "gpt-4o-mini");
    setLlmBaseUrl(appConfig.llmBaseUrl || "");
    if (appConfig.llmStatus) setLlmStatus(appConfig.llmStatus);
    setLlmCustomPrompt(appConfig.llmCustomPrompt || "");
    setLlmKnowledgeBase(appConfig.llmKnowledgeBase || "");
    if (appConfig.llmTone) setLlmTone(appConfig.llmTone);
    setLlmSpecialization(appConfig.llmSpecialization || "Geral");
    if (appConfig.llmExamples?.length) setLlmExamples(appConfig.llmExamples);
    setLlmTemperature(appConfig.llmTemperature ?? 0.7);
    setLlmTopP(appConfig.llmTopP ?? 1);
    setLlmFrequencyPenalty(appConfig.llmFrequencyPenalty ?? 0);
    setLlmPresencePenalty(appConfig.llmPresencePenalty ?? 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // --- Auto-save state ---
  // 'idle' → no pending changes, 'saving' → debounce timer running, 'saved' → recently persisted
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save: whenever any field changes, push to the global config (which DataContext
  // debounces and persists to Supabase). Runs 1.5 s after the last keystroke/toggle.
  // Only activates after the initial config sync is done (configSyncedRef.current = true).
  useEffect(() => {
    // Don't auto-save during the initial sync from Supabase
    if (!configSyncedRef.current) return;
    // Skip on initial render before the user has touched anything
    if (autoSaveTimer.current !== null) {
      setAutoSaveStatus('saving');
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(() => {
      setAppConfig({
        nomeEmpresa:          nomeEmpresa.trim()       || undefined,
        alertaEmailAtivo,
        alertasAtivos,
        emailsAlertaSetor:    emailsSetor,
        webhookGptMaker:      webhookGptMaker.trim()   || undefined,
        webhookN8n:           webhookN8n.trim()        || undefined,
        gptMakerAgentId:      gptMakerAgentId.trim()   || undefined,
        gptMakerApiKey:       gptMakerApiKey.trim()    || undefined,
        llmProvider:          llmProvider as AppConfig['llmProvider'],
        llmApiKey:            llmApiKey.trim()         || undefined,
        llmModel:             llmModel.trim()          || undefined,
        llmBaseUrl:           llmBaseUrl.trim()        || undefined,
        llmStatus,
        llmCustomPrompt:      llmCustomPrompt.trim()   || undefined,
        llmKnowledgeBase:     llmKnowledgeBase.trim()  || undefined,
        llmTone,
        llmSpecialization,
        llmExamples,
        llmTemperature,
        llmTopP,
        llmFrequencyPenalty,
        llmPresencePenalty,
      });
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2500);
    }, 1500);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    nomeEmpresa, alertaEmailAtivo, alertasAtivos, emailsSetor,
    webhookGptMaker, webhookN8n, gptMakerAgentId, gptMakerApiKey,
    llmProvider, llmApiKey, llmModel, llmBaseUrl, llmStatus,
    llmCustomPrompt, llmKnowledgeBase, llmTone, llmSpecialization,
    llmExamples, llmTemperature, llmTopP, llmFrequencyPenalty, llmPresencePenalty,
  ]);

  // --- Sandbox State ---
  const [sandboxInput, setSandboxInput] = useState("");
  const [sandboxOutput, setSandboxOutput] = useState("");
  const [sandboxLoading, setSandboxLoading] = useState(false);

  // --- API Aberta (RF03) ---
  const [apiKey] = useState(appConfig.apiKey || "");
  const [empresaId] = useState(appConfig.empresaId || "");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showApiDocs, setShowApiDocs] = useState(false);

  // --- Logo upload ---
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Apenas imagens são permitidas.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("Imagem muito grande. Limite de 6MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAppConfig({ logoBase64: reader.result as string, logoNome: file.name });
      addLog(currentUser!.id, currentUser!.nome, "Logo atualizada", `Arquivo: ${file.name}`);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setAppConfig({ logoBase64: undefined, logoNome: undefined });
    addLog(currentUser!.id, currentUser!.nome, "Logo removida", "");
  };

  // --- LLM Connection Test ---
  const handleTestLlm = useCallback(async () => {
    if (!llmApiKey.trim()) {
      setLlmStatus("error");
      setError("Insira a chave da API da LLM.");
      return;
    }

    setLlmTesting(true);
    setError(null);

    // Helper to auto-save LLM settings on success
    const autoSaveLlmConfig = (status: "connected" | "error") => {
      setLlmStatus(status);
      if (status === "connected") {
        // Persist LLM settings immediately so they're available everywhere
        setAppConfig({
          ...appConfig,
          llmProvider: llmProvider as AppConfig['llmProvider'],
          llmApiKey: llmApiKey.trim(),
          llmModel: llmModel.trim() || undefined,
          llmBaseUrl: llmBaseUrl.trim() || undefined,
          llmStatus: "connected",
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    };

    try {
      const provider = LLM_PROVIDERS.find((p) => p.value === llmProvider);
      const baseUrl = llmBaseUrl.trim() || provider?.baseUrl || "";

      if (llmProvider === "openai") {
        const resp = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${llmApiKey}` },
        });
        if (resp.ok) {
          autoSaveLlmConfig("connected");
          addLog(currentUser!.id, currentUser!.nome, "LLM conectada", `Provider: ${llmProvider}, Status: Conectado`);
        } else {
          autoSaveLlmConfig("error");
          setError(`Erro ao validar chave OpenAI: ${resp.status}`);
        }
      } else if (llmProvider === "anthropic") {
        // Anthropic doesn't have a simple validation endpoint, so we do a minimal request
        const resp = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            "x-api-key": llmApiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
            "anthropic-dangerous-direct-browser-access": "true"
          },
          body: JSON.stringify({
            model: llmModel || "claude-3-5-sonnet-20241022",
            max_tokens: 10,
            messages: [{ role: "user", content: "Teste" }],
          }),
        });
        if (resp.ok || resp.status === 200) {
          autoSaveLlmConfig("connected");
          addLog(currentUser!.id, currentUser!.nome, "LLM conectada", `Provider: ${llmProvider}, Status: Conectado`);
        } else {
          const body = await resp.text();
          if (resp.status === 401) {
            autoSaveLlmConfig("error");
            setError("Chave API inválida para Anthropic.");
          } else {
            autoSaveLlmConfig("connected"); // Other errors (rate limit etc.) mean key is valid
            addLog(currentUser!.id, currentUser!.nome, "LLM conectada", `Provider: ${llmProvider}, Status: Conectado (${resp.status}: ${body.substring(0, 60)})`);
          }
        }
      } else {
        // For GPTMaker and custom, just check if URL responds
        if (baseUrl) {
          try {
            await fetch(baseUrl, { method: "HEAD", mode: "no-cors" });
            autoSaveLlmConfig("connected");
            addLog(currentUser!.id, currentUser!.nome, "LLM conectada", `Provider: ${llmProvider}`);
          } catch {
            autoSaveLlmConfig("error");
            setError("Não foi possível conectar à URL base.");
          }
        } else {
          autoSaveLlmConfig("connected"); // Assume key is valid
          addLog(currentUser!.id, currentUser!.nome, "LLM configurada", `Provider: ${llmProvider}`);
        }
      }
    } catch (err) {
      setLlmStatus("error");
      setError(`Erro de conexão: ${err instanceof Error ? err.message : "desconhecido"}`);
    } finally {
      setLlmTesting(false);
    }
  }, [llmApiKey, llmProvider, llmModel, llmBaseUrl, addLog, currentUser, appConfig, setAppConfig]);

  // --- Test GPTMaker Connection ---
  const handleTestGptMaker = useCallback(async () => {
    if (!gptMakerAgentId.trim() || !gptMakerApiKey.trim()) {
      setGptMakerTestResult({ ok: false, message: "Preencha o ID do Agente e a API Key." });
      return;
    }
    setGptMakerTesting(true);
    setGptMakerTestResult(null);
    try {
      const baseUrl = webhookGptMaker.trim() || 'https://api.gptmaker.ai';
      const resp = await fetch(`${baseUrl}/v2/agent/${gptMakerAgentId.trim()}/conversation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gptMakerApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contextId: `test-${Date.now()}`,
          prompt: 'Olá, este é um teste de conexão. Responda brevemente.',
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setGptMakerTestResult({ ok: true, message: data.message || 'Conexão bem-sucedida!' });
        addLog(currentUser!.id, currentUser!.nome, "GPTMaker testado", "Conexão OK");
        toast({ title: "✅ GPTMaker conectado!", description: "O agente respondeu com sucesso." });
      } else {
        const body = await resp.text();
        setGptMakerTestResult({ ok: false, message: `Erro ${resp.status}: ${body.substring(0, 150)}` });
        toast({ title: "❌ Erro na conexão", description: `Status ${resp.status}`, variant: "destructive" });
      }
    } catch (err) {
      setGptMakerTestResult({ ok: false, message: `Erro de rede: ${err instanceof Error ? err.message : 'desconhecido'}` });
      toast({ title: "❌ Falha na conexão", description: "Verifique o endpoint e as credenciais.", variant: "destructive" });
    } finally {
      setGptMakerTesting(false);
    }
  }, [gptMakerAgentId, gptMakerApiKey, webhookGptMaker, addLog, currentUser]);

  // --- Generate API Key ---
  const handleGenerateApiKey = () => {
    const newKey = generateApiKey();
    const newId = empresaId || generateEmpresaId();
    setAppConfig({
      apiKey: newKey,
      empresaId: newId,
      apiKeyCreatedAt: new Date().toISOString(),
    });
    addLog(currentUser!.id, currentUser!.nome, "API Key gerada", `Empresa ID: ${newId}`);
  };

  // --- Copy to clipboard ---
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // --- Save all ---
  // --- Update per-sector email ---
  const handleEmailSetorChange = (setorId: string, email: string) => {
    setEmailsSetor(prev => ({ ...prev, [setorId]: email }));
  };

  const handleSaveAll = () => {
    // Cancel any pending auto-save timer so we don't double-write
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    setAppConfig({
      webhookGptMaker: webhookGptMaker.trim() || undefined,
      webhookN8n: webhookN8n.trim() || undefined,
      gptMakerAgentId: gptMakerAgentId.trim() || undefined,
      gptMakerApiKey: gptMakerApiKey.trim() || undefined,
      nomeEmpresa: nomeEmpresa.trim() || undefined,
      alertaEmailAtivo,
      alertasAtivos,
      emailsAlertaSetor: emailsSetor,
      llmProvider: llmProvider as AppConfig['llmProvider'],
      llmApiKey: llmApiKey.trim() || undefined,
      llmModel: llmModel.trim() || undefined,
      llmBaseUrl: llmBaseUrl.trim() || undefined,
      llmStatus,
      llmCustomPrompt: llmCustomPrompt.trim() || undefined,
      llmKnowledgeBase: llmKnowledgeBase.trim() || undefined,
      llmTone,
      llmSpecialization,
      llmExamples,
      llmTemperature,
      llmTopP,
      llmFrequencyPenalty,
      llmPresencePenalty,
    });
    addLog(currentUser!.id, currentUser!.nome, "Configurações salvas", "Treinamento e parâmetros de IA atualizados");
    setAutoSaveStatus('saved');
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setAutoSaveStatus('idle');
    }, 2000);
  };

  const handleTestSandbox = async () => {
    if (!sandboxInput.trim()) return;
    setSandboxLoading(true);
    setSandboxOutput("");

    // Use current state for testing (no need to save first)
    const testConfig: AppConfig = {
      ...appConfig,
      llmProvider: llmProvider as any,
      llmApiKey,
      llmModel,
      llmBaseUrl,
      llmStatus: 'connected',
      llmCustomPrompt,
      llmKnowledgeBase,
      llmTone,
      llmSpecialization,
      llmExamples,
      llmTemperature,
      llmTopP,
      llmFrequencyPenalty,
      llmPresencePenalty,
    };

    try {
      const result = await callLlmApi(
        testConfig,
        [{ role: 'user', content: sandboxInput }],
        "Você é um assistente configurado pelo usuário. Responda seguindo estritamente as instruções fornecidas."
      );
      setSandboxOutput(result || "Sem resposta da IA.");
    } catch (err) {
      setSandboxOutput(`Erro no teste: ${err instanceof Error ? err.message : "Desconhecido"}`);
    } finally {
      setSandboxLoading(false);
    }
  };

  const currentProvider = LLM_PROVIDERS.find((p) => p.value === llmProvider);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie identidade visual, integrações, IA e API
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-save status indicator */}
          {autoSaveStatus === 'saving' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium animate-pulse">
              <Cloud className="w-3.5 h-3.5" /> Salvando...
            </span>
          )}
          {autoSaveStatus === 'saved' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
              <Check className="w-3.5 h-3.5" /> Salvo no Supabase
            </span>
          )}
          {autoSaveStatus === 'error' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
              <CloudOff className="w-3.5 h-3.5" /> Erro ao salvar
            </span>
          )}
          <button
            onClick={() => navigate('/creditos')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
          >
            <Coins className="w-4 h-4" /> Ver Tabela de Créditos LLM
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto p-1">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ====== Identidade Visual ====== */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Image className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Identidade Visual</h3>
            <p className="text-xs text-muted-foreground">Logomarca e nome da empresa</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden flex-shrink-0">
            {appConfig.logoBase64 ? (
              <img src={appConfig.logoBase64} alt="Logo" className="w-full h-full object-contain p-2" />
            ) : (
              <Image className="w-8 h-8 text-muted-foreground opacity-30" />
            )}
          </div>
          <div className="space-y-2">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input bg-background text-sm text-muted-foreground hover:bg-secondary transition-colors">
              <Upload className="w-3.5 h-3.5" /> Upload Logo
            </button>
            {appConfig.logoBase64 && (
              <button onClick={handleRemoveLogo}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/30 text-sm text-destructive hover:bg-destructive/10 transition-colors ml-2">
                <Trash2 className="w-3.5 h-3.5" /> Remover
              </button>
            )}
            {appConfig.logoNome && (
              <p className="text-xs text-muted-foreground">{appConfig.logoNome}</p>
            )}
            <p className="text-[10px] text-muted-foreground">PNG, JPG ou SVG. Máx. 6MB.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Nome da Empresa</label>
          <input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} placeholder="Ex: Fundação Assistencial da Paraíba"
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      {/* ====== Integração com LLM (RF01) ====== */}
      {isAdmin && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Brain className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">Integração com LLM</h3>
              <p className="text-xs text-muted-foreground">
                Conecte uma IA para o chat de geração de contratos
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${llmTesting
              ? "bg-yellow-100 text-yellow-700"
              : llmStatus === "connected"
                ? "bg-green-100 text-green-700"
                : llmStatus === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-500"
              }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${llmTesting ? "bg-yellow-500 animate-pulse" : llmStatus === "connected" ? "bg-green-500" : llmStatus === "error" ? "bg-red-500" : "bg-gray-400"
                }`} />
              {llmTesting ? "Testando..." : llmStatus === "connected" ? "Conectado" : llmStatus === "error" ? "Erro" : "Não Conectado"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Provedor</label>
              <select value={llmProvider} onChange={(e) => {
                const val = e.target.value as 'openai' | 'anthropic' | 'gptmaker' | 'custom';
                const p = LLM_PROVIDERS.find((pr) => pr.value === val);
                setLlmProvider(val);
                if (p) {
                  setLlmBaseUrl(p.baseUrl);
                  setLlmModel(p.defaultModel);
                }
              }} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring">
                {LLM_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Modelo</label>
              {currentProvider && currentProvider.models.length > 0 ? (
                <select value={llmModel} onChange={(e) => setLlmModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring font-mono text-xs">
                  {currentProvider.models.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                  <option value="__custom__">Outro (digitar manualmente)</option>
                </select>
              ) : (
                <input value={llmModel} onChange={(e) => setLlmModel(e.target.value)} placeholder="Nome do modelo"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring font-mono text-xs" />
              )}
              {llmModel === '__custom__' && (
                <input value={''} onChange={(e) => setLlmModel(e.target.value)} placeholder="Digite o nome do modelo..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring font-mono text-xs mt-1.5" />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Chave da API da LLM</label>
            <div className="flex gap-2">
              <input value={llmApiKey} onChange={(e) => setLlmApiKey(e.target.value)} placeholder="sk-..."
                type="password"
                className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring font-mono text-xs" />
              <button onClick={handleTestLlm} disabled={!llmApiKey.trim() || llmTesting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {llmTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {llmTesting ? 'Testando...' : 'Testar'}
              </button>
            </div>
          </div>

          {(llmProvider === "custom" || llmProvider === "gptmaker" || llmProvider === "meta" || !LLM_PROVIDERS.find(p => p.value === llmProvider)?.baseUrl) && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">URL Base (endpoint)</label>
              <input value={llmBaseUrl} onChange={(e) => setLlmBaseUrl(e.target.value)} placeholder="https://api.exemplo.com/v1"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring font-mono text-xs" />
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Compatível com: OpenAI, Anthropic, Google Gemini, Meta Llama, Mistral, Cohere, DeepSeek, Groq, Perplexity, xAI Grok, GPTMaker e qualquer API compatível com formato OpenAI Chat Completions.
          </p>
        </div>
      )}

      {/* ====== Treinamento do Agente de IA (Restored UI) ====== */}
      {isAdmin && (
        <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          {/* Header Card */}
          <div className="p-6 flex items-center justify-between bg-white border-b border-border/50">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-purple-100 flex items-center justify-center">
                <Brain className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1a2d5a]">Treinamento do Agente IA</h3>
                <p className="text-xs text-muted-foreground">Prompt, tom, exemplos e documentos de referência</p>
              </div>
            </div>
            <button
              onClick={() => setTrainingCollapsed(!trainingCollapsed)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              {trainingCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              {trainingCollapsed ? "Expandir" : "Recolher"}
            </button>
          </div>

          {!trainingCollapsed && (
            <div className="p-6 space-y-8 bg-[#fcfdfe]">

              {/* 1. Prompt do Sistema */}
              <div className="bg-white rounded-xl border border-border p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-pink-100">
                    <Brain className="w-5 h-5 text-pink-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Prompt do Sistema</h4>
                    <p className="text-xs text-muted-foreground">Instruções personalizadas para o comportamento do agente</p>
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    value={llmCustomPrompt}
                    onChange={(e) => setLlmCustomPrompt(e.target.value)}
                    placeholder="Ex: Você é um assistente jurídico especializado em contratos públicos. Sempre responda de forma clara e cite as cláusulas relevantes..."
                    className="w-full h-40 p-4 rounded-xl border border-border bg-[#f8fafc] text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none placeholder:text-muted-foreground/50 transition-all font-medium"
                    maxLength={5000}
                  />
                  <div className="absolute bottom-3 left-4 text-[10px] text-muted-foreground/60">
                    {llmCustomPrompt.length}/5000 caracteres
                  </div>
                </div>
              </div>

              {/* 2. Personalidade e Especialização */}
              <div className="bg-white rounded-xl border border-border p-6 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-100">
                    <RefreshCw className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Personalidade & Especialização</h4>
                    <p className="text-xs text-muted-foreground">Tom e área de atuação do agente</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-muted-foreground block">Tom de Resposta</label>
                    <div className="space-y-2">
                      {[
                        { id: 'formal', label: 'Formal', desc: 'Linguagem profissional e jurídica' },
                        { id: 'informal', label: 'Informal', desc: 'Linguagem acessível e simplificada' },
                        { id: 'tecnico', label: 'Técnico', desc: 'Termos técnicos e precisos' }
                      ].map((t) => (
                        <label key={t.id} className={`flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${llmTone === t.id ? 'border-[#1a2d5a] bg-blue-50/30' : 'border-border bg-white hover:border-border/80'}`}>
                          <input
                            type="radio"
                            name="tone"
                            className="mt-1"
                            checked={llmTone === t.id}
                            onChange={() => setLlmTone(t.id as any)}
                          />
                          <div>
                            <p className="text-sm font-bold text-[#1a2d5a]">{t.label}</p>
                            <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-muted-foreground block">Área de Especialização</label>
                    <select
                      value={llmSpecialization}
                      onChange={(e) => setLlmSpecialization(e.target.value)}
                      className="w-full p-3.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-primary/20 outline-none appearance-none font-medium"
                    >
                      <option value="Geral">Geral</option>
                      <option value="Jurídico">Jurídico</option>
                      <option value="Compras">Compras / Licitação</option>
                      <option value="TI">Tecnologia da Informação</option>
                      <option value="Gestão">Gestão de Contratos</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Exemplos de Perguntas e Respostas */}
              <div className="bg-white rounded-xl border border-border p-6 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Code className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Exemplos de Perguntas e Respostas</h4>
                    <p className="text-xs text-muted-foreground">Ensine o agente com exemplos específicos</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {llmExamples.map((ex, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-muted/30 border border-border relative group">
                      <button
                        onClick={() => setLlmExamples(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-2 -right-2 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <p className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">Exemplo {idx + 1}</p>
                      <p className="text-sm font-medium text-foreground">Q: {ex.user}</p>
                      <p className="text-sm text-muted-foreground mt-2">A: {ex.assistant}</p>
                    </div>
                  ))}

                  <div className="space-y-3 border-t border-border pt-4">
                    <div className="space-y-2">
                      <input
                        id="new-example-q"
                        placeholder="Pergunta do usuário..."
                        className="w-full p-3.5 rounded-xl border border-border bg-[#f8fafc] text-sm focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                      />
                      <textarea
                        id="new-example-a"
                        placeholder="Resposta esperada do agente..."
                        rows={3}
                        className="w-full p-3.5 rounded-xl border border-border bg-[#f8fafc] text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none font-medium"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const q = (document.getElementById('new-example-q') as HTMLInputElement).value;
                        const a = (document.getElementById('new-example-a') as HTMLTextAreaElement).value;
                        if (q && a) {
                          setLlmExamples(prev => [...prev, { user: q, assistant: a }]);
                          (document.getElementById('new-example-q') as HTMLInputElement).value = '';
                          (document.getElementById('new-example-a') as HTMLTextAreaElement).value = '';
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm font-bold hover:bg-blue-100 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" /> Adicionar Exemplo
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Documentos de Referência */}
              <div className="bg-white rounded-xl border border-border p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <Shield className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Documentos de Referência</h4>
                    <p className="text-xs text-muted-foreground">PDFs e textos que o agente usará como base de conhecimento</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-8 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center bg-[#f8fafc] group hover:border-primary/50 transition-colors">
                    <button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.pdf,.txt,.doc,.docx';
                        input.onchange = async (e: any) => {
                          const file = e.target.files[0];
                          if (!file) return;

                          toast({
                            title: "🔍 Processando documento",
                            description: `Extraindo texto de "${file.name}" para a base de conhecimento...`,
                          });

                          try {
                            const text = await extractTextFromFile(file, appConfig, file.name);
                            if (text && text.trim().length > 10) {
                              const cleanText = text.trim();

                              let contentToAdd = cleanText;

                              // Intelligent Summarization for Knowledge Base
                              if (appConfig.llmApiKey && appConfig.llmStatus === 'connected') {
                                toast({
                                  title: "🧠 IA Processando...",
                                  description: "Resumindo pontos-chave para a base de conhecimento..."
                                });

                                const summary = await callLlmApi(
                                  appConfig,
                                  [{ role: 'user', content: `Resuma o seguinte documento para compor uma base de conhecimento jurídica. Foque em regras, definições, cláusulas padrão e entidades:\n\n${cleanText.substring(0, 8000)}` }],
                                  "Você é um especialista em gestão de conhecimento jurídico. Crie um resumo estruturado e denso em informações úteis."
                                );

                                if (summary) {
                                  contentToAdd = summary;
                                }
                              }

                              setLlmKnowledgeBase(prev => {
                                const header = `\n\n--- CONHECIMENTO: ${file.name.toUpperCase()} ---\n`;
                                return prev + header + contentToAdd + "\n";
                              });

                              toast({
                                title: "✅ Base atualizada",
                                description: `Integrou "${file.name}" à inteligência do sistema.`,
                              });
                            } else {
                              toast({
                                title: "⚠️ Falha na extração",
                                description: "Não foi possível extrair texto legível deste arquivo.",
                                variant: "destructive"
                              });
                            }
                          } catch (err) {
                            console.error("Knowledge base upload failed:", err);
                            toast({
                              title: "❌ Erro no upload",
                              description: "Ocorreu uma falha ao processar o documento.",
                              variant: "destructive"
                            });
                          }
                        };
                        input.click();
                      }}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border bg-white text-sm font-bold text-foreground hover:shadow-md transition-all active:scale-95"
                    >
                      <Upload className="w-4 h-4" /> Upload Documento
                    </button>
                    <p className="mt-4 text-[11px] text-muted-foreground">PDF, TXT, DOC ou DOCX. Máx. 10.000 caracteres extraídos por documento.</p>
                  </div>

                  {/* Knowledge Base display (synced with the upload) */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Base de Conhecimento (Texto Consolidado)</label>
                    <textarea
                      value={llmKnowledgeBase}
                      onChange={(e) => setLlmKnowledgeBase(e.target.value)}
                      rows={6}
                      className="w-full p-4 rounded-xl border border-border bg-[#f8fafc] font-mono text-xs focus:ring-2 focus:ring-primary/20 outline-none resize-none leading-relaxed"
                      placeholder="DICA: O conteúdo dos documentos carregados aparecerá aqui. Você também pode digitar textos de referência manualmente."
                    />
                  </div>
                </div>
              </div>

              {/* 5. Controle de Criatividade e Parâmetros (Professional Addition) */}
              <div className="bg-white rounded-xl border border-border p-6 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100">
                    <Settings className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Ajustes Finos (Parâmetros Profissionais)</h4>
                    <p className="text-xs text-muted-foreground">Controle a criatividade, aleatoriedade e repetição da IA</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  {/* Temperature */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-xs font-semibold text-muted-foreground">Temperatura (Criatividade)</label>
                      <span className="text-xs font-mono text-primary font-bold">{llmTemperature.toFixed(2)}</span>
                    </div>
                    <input
                      type="range" min="0" max="2" step="0.1"
                      value={llmTemperature}
                      onChange={(e) => setLlmTemperature(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-[#1a2d5a]"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground italic">
                      <span>Mais Preciso</span>
                      <span>Mais Criativo</span>
                    </div>
                  </div>

                  {/* Top P */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-xs font-semibold text-muted-foreground">Top P (Diversidade)</label>
                      <span className="text-xs font-mono text-primary font-bold">{llmTopP.toFixed(2)}</span>
                    </div>
                    <input
                      type="range" min="0" max="1" step="0.05"
                      value={llmTopP}
                      onChange={(e) => setLlmTopP(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-[#1a2d5a]"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground italic">
                      <span>Focado</span>
                      <span>Diversificado</span>
                    </div>
                  </div>

                  {/* Frequency Penalty */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-xs font-semibold text-muted-foreground">Penalidade de Frequência</label>
                      <span className="text-xs font-mono text-primary font-bold">{llmFrequencyPenalty.toFixed(2)}</span>
                    </div>
                    <input
                      type="range" min="0" max="2" step="0.1"
                      value={llmFrequencyPenalty}
                      onChange={(e) => setLlmFrequencyPenalty(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-[#1a2d5a]"
                    />
                    <p className="text-[9px] text-muted-foreground">Evita repetição de palavras idênticas</p>
                  </div>

                  {/* Presence Penalty */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-xs font-semibold text-muted-foreground">Penalidade de Presença</label>
                      <span className="text-xs font-mono text-primary font-bold">{llmPresencePenalty.toFixed(2)}</span>
                    </div>
                    <input
                      type="range" min="0" max="2" step="0.1"
                      value={llmPresencePenalty}
                      onChange={(e) => setLlmPresencePenalty(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-[#1a2d5a]"
                    />
                    <p className="text-[9px] text-muted-foreground">Incentiva a IA a falar sobre novos tópicos</p>
                  </div>
                </div>
              </div>

              {/* 6. Sandbox de Teste (The "Professional" Touch) */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-6 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <RefreshCw className={`w-5 h-5 text-blue-400 ${sandboxLoading ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      Sandbox de Experimentação
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[9px] uppercase tracking-wider">Beta</span>
                    </h4>
                    <p className="text-xs text-slate-400">Teste as configurações de treinamento em tempo real antes de salvar</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      value={sandboxInput}
                      onChange={(e) => setSandboxInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !sandboxLoading && handleTestSandbox()}
                      placeholder="Faça uma pergunta para testar a nova persona..."
                      className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                    />
                    <button
                      onClick={handleTestSandbox}
                      disabled={sandboxLoading || !sandboxInput.trim()}
                      className="px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-blue-500/20"
                    >
                      {sandboxLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Testar IA"}
                    </button>
                  </div>

                  {sandboxOutput && (
                    <div className="p-5 rounded-xl bg-slate-800/50 border border-slate-700/50 animate-in fade-in slide-in-from-top-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Resposta da IA (Modo Teste)</p>
                      <div className="text-sm text-slate-300 leading-relaxed font-medium whitespace-pre-wrap italic">
                        "{sandboxOutput}"
                      </div>
                    </div>
                  )}

                  {!sandboxOutput && !sandboxLoading && (
                    <p className="text-[10px] text-center text-slate-500 italic">
                      A resposta aparecerá aqui. Use este espaço para validar se o tom e a base de conhecimento estão corretos.
                    </p>
                  )}
                </div>
              </div>

              {/* Botão Salvar (Enhanced Visual Feedback) */}
              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5" />
                  Salvo automaticamente no Supabase a cada alteração
                </p>
                <button
                  onClick={handleSaveAll}
                  disabled={saved}
                  className={`inline-flex items-center gap-2 px-10 py-4 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 ${saved
                    ? "bg-green-600 text-white"
                    : "bg-[#1a2d5a] text-white hover:opacity-90 hover:shadow-xl"
                    }`}
                >
                  {saved ? (
                    <><Check className="w-5 h-5" /> Treinamento Aplicado com Sucesso!</>
                  ) : (
                    <><Save className="w-5 h-5" /> Salvar e Aplicar Treinamento</>
                  )}
                </button>
              </div>

            </div>
          )}
        </div>
      )}

      {/* ====== Webhooks ====== */}
      {isAdmin && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Link2 className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Integrações — Webhooks</h3>
              <p className="text-xs text-muted-foreground">Endpoints e credenciais para integração com GPTMaker e n8n</p>
            </div>
          </div>

          {/* GPTMaker */}
          <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-muted/10">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 text-primary" /> GPTMaker
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Endpoint (URL do Webhook)</label>
                <input value={webhookGptMaker} onChange={(e) => setWebhookGptMaker(e.target.value)} placeholder="https://api.gptmaker.ai/v1/chat/completions"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring font-mono text-xs" />
                <p className="text-[10px] text-muted-foreground/70">URL completa do endpoint do GPTMaker (ex: https://api.gptmaker.ai/v1/chat/completions)</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">ID do Agente</label>
                <input value={gptMakerAgentId} onChange={(e) => setGptMakerAgentId(e.target.value)} placeholder="agent_xxxxxxxx"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring font-mono text-xs" />
                <p className="text-[10px] text-muted-foreground/70">Identificador único do agente no GPTMaker</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Chave de API (API Key)</label>
                <input value={gptMakerApiKey} onChange={(e) => setGptMakerApiKey(e.target.value)} placeholder="gptm_xxxxxxxxxxxxxxxx" type="password"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring font-mono text-xs" />
                <p className="text-[10px] text-muted-foreground/70">Chave de autenticação da API do GPTMaker</p>
              </div>
            </div>
            {/* Test GPTMaker button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleTestGptMaker}
                disabled={gptMakerTesting || !gptMakerAgentId.trim() || !gptMakerApiKey.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {gptMakerTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {gptMakerTesting ? 'Testando...' : 'Testar Conexão GPTMaker'}
              </button>
              {gptMakerTestResult && (
                <span className={`text-xs font-medium flex items-center gap-1 ${gptMakerTestResult.ok ? 'text-green-600' : 'text-destructive'}`}>
                  {gptMakerTestResult.ok ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {gptMakerTestResult.ok ? 'Conectado!' : 'Falhou'}
                </span>
              )}
            </div>
            {gptMakerTestResult?.message && (
              <div className={`p-3 rounded-lg text-xs mt-2 ${gptMakerTestResult.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                <p className="font-medium mb-1">{gptMakerTestResult.ok ? '✅ Resposta do Agente:' : '❌ Detalhes do Erro:'}</p>
                <p className="whitespace-pre-wrap">{gptMakerTestResult.message}</p>
              </div>
            )}
          </div>

          {/* n8n */}
          <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-muted/10">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Code className="w-3.5 h-3.5 text-primary" /> n8n — Automação
            </h4>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Webhook n8n (URL)</label>
              <input value={webhookN8n} onChange={(e) => setWebhookN8n(e.target.value)} placeholder="https://n8n.exemplo.com/webhook/contrato-analise"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring font-mono text-xs" />
              <p className="text-[10px] text-muted-foreground/70">URL do webhook configurado no n8n para receber dados de contratos</p>
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSaveAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 shadow-sm transition-all active:scale-[0.98]"
            >
              <Save className="w-4 h-4" /> Salvar Integrações
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-xs text-success font-medium">
                <Check className="w-3.5 h-3.5" /> Salvo!
              </span>
            )}
          </div>
        </div>
      )}

      {/* ====== API Aberta (RF03) ====== */}
      {isAdmin && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Key className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">API Aberta para Integrações</h3>
              <p className="text-xs text-muted-foreground">
                Chave de API e ID da empresa para integrações externas
              </p>
            </div>
          </div>

          {/* Credentials */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">ID da Empresa</label>
              <div className="flex gap-2">
                <input value={appConfig.empresaId || empresaId || "(não gerado)"} readOnly
                  className="flex-1 px-3 py-2 rounded-lg border border-input bg-muted/20 text-sm font-mono text-xs text-foreground" />
                {(appConfig.empresaId || empresaId) && (
                  <button onClick={() => copyToClipboard(appConfig.empresaId || empresaId, "empresaId")}
                    className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary">
                    {copiedField === "empresaId" ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Chave de API</label>
              <div className="flex gap-2">
                <input value={appConfig.apiKey || apiKey || "(não gerada)"} readOnly type="password"
                  className="flex-1 px-3 py-2 rounded-lg border border-input bg-muted/20 text-sm font-mono text-xs text-foreground" />
                {(appConfig.apiKey || apiKey) && (
                  <button onClick={() => copyToClipboard(appConfig.apiKey || apiKey, "apiKey")}
                    className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary">
                    {copiedField === "apiKey" ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
            {appConfig.apiKeyCreatedAt && (
              <p className="text-[10px] text-muted-foreground">
                Gerada em: {new Date(appConfig.apiKeyCreatedAt).toLocaleString("pt-BR")}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleGenerateApiKey}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> {(appConfig.apiKey || apiKey) ? "Gerar Nova Chave" : "Gerar Chave de API"}
            </button>
            <button onClick={() => setShowApiDocs(!showApiDocs)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors">
              <Code className="w-3.5 h-3.5" /> {showApiDocs ? "Ocultar Endpoints" : "Ver Endpoints"}
            </button>
          </div>

          {/* API Documentation — detailed per-endpoint */}
          {showApiDocs && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border/50">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Shield className="w-3.5 h-3.5 text-blue-600" /> Documentação da API REST
              </div>
              <p className="text-[10px] text-muted-foreground">
                Todos os endpoints requerem autenticação via header <code className="bg-muted px-1 rounded">Authorization: Bearer {'{API_KEY}'}</code> (exceto registro).
                Base URL: <code className="bg-muted px-1 rounded">https://seu-dominio.com</code>
              </p>

              <div className="space-y-2">
                {API_ENDPOINTS.map((ep, i) => (
                  <div key={i} className="border border-border/60 rounded-lg overflow-hidden">
                    {/* Endpoint header (clickable) */}
                    <button onClick={() => setExpandedEndpoint(expandedEndpoint === i ? null : i)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs hover:bg-muted/30 transition-colors">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${ep.method === "POST" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                        {ep.method}
                      </span>
                      <span className="font-mono text-foreground">{ep.path}</span>
                      <span className="text-muted-foreground ml-auto text-[10px] mr-2">{ep.desc}</span>
                      {expandedEndpoint === i ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                    </button>

                    {/* Expanded detail */}
                    {expandedEndpoint === i && (
                      <div className="px-3 pb-3 space-y-3 border-t border-border/40 pt-3">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{ep.description}</p>

                        {/* Headers */}
                        <div>
                          <p className="text-[10px] font-semibold text-foreground mb-1">📋 Headers</p>
                          <pre className="bg-gray-900 rounded-md p-2 text-[10px] font-mono text-gray-300 overflow-x-auto">{ep.headers}</pre>
                        </div>

                        {/* Request Body */}
                        {ep.requestBody && (
                          <div>
                            <p className="text-[10px] font-semibold text-foreground mb-1">📤 Request Body</p>
                            <pre className="bg-gray-900 rounded-md p-2 text-[10px] font-mono text-yellow-300 overflow-x-auto">{ep.requestBody}</pre>
                          </div>
                        )}

                        {/* Response */}
                        <div>
                          <p className="text-[10px] font-semibold text-foreground mb-1">📥 Response</p>
                          <pre className="bg-gray-900 rounded-md p-2 text-[10px] font-mono text-green-300 overflow-x-auto">{ep.responseBody}</pre>
                        </div>

                        {/* Status Codes */}
                        <div>
                          <p className="text-[10px] font-semibold text-foreground mb-1">📊 Status Codes</p>
                          <div className="space-y-0.5">
                            {ep.statusCodes.map((sc, j) => {
                              const code = sc.substring(0, 3);
                              const isSuccess = code.startsWith('2');
                              const isClient = code.startsWith('4');
                              return (
                                <div key={j} className="flex items-center gap-2 text-[10px]">
                                  <span className={`px-1 py-0.5 rounded font-mono font-bold ${isSuccess ? 'bg-green-100 text-green-700' : isClient ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{code}</span>
                                  <span className="text-muted-foreground">{sc.substring(4)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====== Notificações e Alertas ====== */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10">
            <Bell className="w-5 h-5 text-warning" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Notificações e Alertas</h3>
            <p className="text-xs text-muted-foreground">Ativar/desativar alertas e configurar e-mails por setor</p>
          </div>
        </div>

        {/* Global Alert Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
          <div className="flex items-center gap-3">
            <Power className={`w-5 h-5 ${alertasAtivos ? 'text-green-500' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-sm text-foreground font-medium">Alertas do Sistema</p>
              <p className="text-xs text-muted-foreground">
                {alertasAtivos ? 'Alertas ativos — vencimento, cláusulas abusivas e análise IA' : 'Alertas desativados — nenhuma notificação será gerada'}
              </p>
            </div>
          </div>
          <button onClick={() => setAlertasAtivos(!alertasAtivos)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${alertasAtivos
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-muted text-muted-foreground hover:bg-secondary'
              }`}>
            {alertasAtivos ? '✅ Ativado' : '⏸️ Desativado'}
          </button>
        </div>

        {/* Email Toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div onClick={() => setAlertaEmailAtivo(!alertaEmailAtivo)}
            className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${alertaEmailAtivo ? "bg-primary" : "bg-muted"}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${alertaEmailAtivo ? "left-5" : "left-1"}`} />
          </div>
          <div>
            <p className="text-sm text-foreground font-medium">Alertas por e-mail</p>
            <p className="text-xs text-muted-foreground">Enviar alertas de vencimento e cláusulas abusivas por e-mail</p>
          </div>
        </label>

        {/* Per-sector email fields */}
        {alertaEmailAtivo && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <p className="text-xs font-semibold text-foreground">E-mails por Setor</p>
              <span className="text-[10px] text-muted-foreground">({setores.length} setor{setores.length !== 1 ? 'es' : ''})</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Defina o e-mail de cada setor para receber alertas de contratos vinculados.
            </p>
            {setores.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum setor cadastrado. Adicione setores primeiro.</p>
            ) : (
              <div className="space-y-2">
                {setores.map((setor) => (
                  <div key={setor.id} className="flex items-center gap-3">
                    <div className="w-32 flex-shrink-0">
                      <span className="text-xs font-medium text-foreground">{setor.nome}</span>
                    </div>
                    <div className="flex-1 relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        value={emailsSetor[setor.id] || ''}
                        onChange={(e) => handleEmailSetorChange(setor.id, e.target.value)}
                        type="email"
                        placeholder={`email@${setor.nome.toLowerCase().replace(/\s+/g, '')}.com`}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    {emailsSetor[setor.id] && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ====== Save ====== */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Cloud className="w-3.5 h-3.5" />
          As alterações são salvas automaticamente no Supabase após 1,5&nbsp;s de inatividade.
        </p>
        <button onClick={handleSaveAll}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${saved ? "bg-success text-white" : "bg-primary text-primary-foreground hover:opacity-90"
            }`}>
          {saved ? (
            <><Check className="w-4 h-4" /> Salvo!</>
          ) : (
            <><Save className="w-4 h-4" /> Salvar Agora</>
          )}
        </button>
      </div>
    </motion.div>
  );
}
