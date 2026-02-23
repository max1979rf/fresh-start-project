import type { AppConfig } from '../types';
import { analyzeContract, parseContractFields, analyzeValues, generateContractNumber } from './pdfAnalyzer';

export interface LlmAnalysisResult {
  // Extracted fields
  numero?: string;
  empresa?: string;
  objeto?: string;
  descricao?: string;
  valor?: string;
  dataInicio?: string;
  dataVencimento?: string;
  tipo?: string;
  // Analysis
  hasAbusiveClauses: boolean;
  missingSignature: boolean;
  findings: string[];
  autoFilled: boolean;
}

const ANALYSIS_PROMPT = `Você é um analista jurídico especializado em contratos. Analise o texto do contrato abaixo e retorne EXATAMENTE um JSON com a seguinte estrutura (sem markdown, sem explicação, apenas o JSON):

{
  "numero": "número do contrato se encontrado",
  "empresa": "nome da empresa contratada",
  "objeto": "objeto/descrição do contrato",
  "valor": "valor total (formato R$ X.XXX,XX)",
  "dataInicio": "YYYY-MM-DD",
  "dataVencimento": "YYYY-MM-DD",
  "tipo": "Serviço|Fornecimento|Obra|Consultoria|Locação",
  "clausulasAbusivas": ["lista de cláusulas abusivas encontradas"],
  "assinaturaPresente": true/false,
  "alertas": ["lista de alertas e observações importantes"],
  "resumo": "resumo breve do contrato em 1-2 frases"
}

Identifique especialmente:
- Multas abusivas (acima de 10%)
- Renúncia de direitos
- Rescisão unilateral sem aviso
- Renovação automática sem consentimento
- Exclusividade indevida
- Prazo indeterminado
- Responsabilidade ilimitada
- Falta de assinatura

TEXTO DO CONTRATO:
`;

/**
 * Calls the configured LLM to analyze contract text.
 * Falls back to local analysis if LLM is not configured or fails.
 */
export async function analyzWithLlm(
  text: string,
  appConfig: AppConfig,
  existingNumbers: string[]
): Promise<LlmAnalysisResult> {
  const hasLlm = appConfig.llmApiKey && appConfig.llmStatus === 'connected';

  // Try LLM analysis first
  if (hasLlm && text.length > 20) {
    try {
      const llmResult = await callLlmProvider(text, appConfig);
      if (llmResult) {
        return buildResultFromLlm(llmResult, text, existingNumbers);
      }
    } catch (err) {
      console.warn('LLM analysis failed, falling back to local:', err);
    }
  }

  // Fallback to local analysis
  return localAnalysis(text, existingNumbers);
}

function localAnalysis(text: string, existingNumbers: string[]): LlmAnalysisResult {
  const fields = parseContractFields(text);
  const analysis = analyzeContract(text);
  const valueAnalysis = analyzeValues(text);

  return {
    numero: fields.numero || generateContractNumber(existingNumbers),
    empresa: fields.empresa,
    objeto: fields.objeto,
    descricao: fields.objeto,
    valor: fields.valor,
    dataInicio: fields.dataInicio,
    dataVencimento: fields.dataVencimento,
    tipo: fields.tipo,
    hasAbusiveClauses: analysis.hasAbusiveClauses,
    missingSignature: analysis.missingSignature,
    findings: [...analysis.findings, ...valueAnalysis.alertas],
    autoFilled: !!(fields.numero || fields.empresa || fields.objeto || fields.valor),
  };
}

interface LlmParsed {
  numero?: string;
  empresa?: string;
  objeto?: string;
  valor?: string;
  dataInicio?: string;
  dataVencimento?: string;
  tipo?: string;
  clausulasAbusivas?: string[];
  assinaturaPresente?: boolean;
  alertas?: string[];
  resumo?: string;
}

function buildResultFromLlm(parsed: LlmParsed, text: string, existingNumbers: string[]): LlmAnalysisResult {
  const findings: string[] = [];

  // Abusive clauses from LLM
  if (parsed.clausulasAbusivas?.length) {
    parsed.clausulasAbusivas.forEach(c => findings.push(`⚠️ ${c}`));
  }

  // Missing signature
  if (parsed.assinaturaPresente === false) {
    findings.push('🔴 Assinatura não identificada no documento');
  }

  // Extra alerts from LLM
  if (parsed.alertas?.length) {
    parsed.alertas.forEach(a => findings.push(`⚡ ${a}`));
  }

  // Add summary as info
  if (parsed.resumo) {
    findings.push(`ℹ️ ${parsed.resumo}`);
  }

  const hasAbusiveClauses = (parsed.clausulasAbusivas?.length || 0) > 0;

  return {
    numero: parsed.numero || generateContractNumber(existingNumbers),
    empresa: parsed.empresa,
    objeto: parsed.objeto,
    descricao: parsed.objeto,
    valor: parsed.valor,
    dataInicio: parsed.dataInicio,
    dataVencimento: parsed.dataVencimento,
    tipo: parsed.tipo,
    hasAbusiveClauses,
    missingSignature: parsed.assinaturaPresente === false,
    findings,
    autoFilled: !!(parsed.numero || parsed.empresa || parsed.objeto || parsed.valor),
  };
}

async function callLlmProvider(text: string, config: AppConfig): Promise<LlmParsed | null> {
  const provider = config.llmProvider;
  const apiKey = config.llmApiKey!;
  const model = config.llmModel || 'gpt-4o-mini';
  const truncatedText = text.substring(0, 8000); // Limit token usage

  if (provider === 'openai' || provider === 'deepseek' || provider === 'groq' || provider === 'mistral' || provider === 'perplexity' || provider === 'xai') {
    // OpenAI-compatible API
    const baseUrl = config.llmBaseUrl?.trim() || getDefaultBaseUrl(provider);
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Você é um analista jurídico. Responda apenas com JSON válido, sem markdown.' },
          { role: 'user', content: ANALYSIS_PROMPT + truncatedText }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!resp.ok) throw new Error(`LLM API error: ${resp.status}`);
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    return parseJsonResponse(content);
  }

  if (provider === 'anthropic') {
    const baseUrl = config.llmBaseUrl?.trim() || 'https://api.anthropic.com/v1';
    const resp = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{ role: 'user', content: ANALYSIS_PROMPT + truncatedText }],
      }),
    });

    if (!resp.ok) throw new Error(`Anthropic API error: ${resp.status}`);
    const data = await resp.json();
    const content = data.content?.[0]?.text || '';
    return parseJsonResponse(content);
  }

  if (provider === 'google') {
    const baseUrl = config.llmBaseUrl?.trim() || 'https://generativelanguage.googleapis.com/v1beta';
    const modelId = model || 'gemini-2.0-flash';
    const resp = await fetch(`${baseUrl}/models/${modelId}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: ANALYSIS_PROMPT + truncatedText }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
      }),
    });

    if (!resp.ok) throw new Error(`Google API error: ${resp.status}`);
    const data = await resp.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseJsonResponse(content);
  }

  // GPTMaker or custom — try OpenAI-compatible format
  if (config.llmBaseUrl?.trim()) {
    const resp = await fetch(config.llmBaseUrl.trim(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: ANALYSIS_PROMPT + truncatedText }
        ],
      }),
    });

    if (!resp.ok) throw new Error(`Custom API error: ${resp.status}`);
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || data.response || data.text || '';
    return parseJsonResponse(content);
  }

  return null;
}

function getDefaultBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    deepseek: 'https://api.deepseek.com/v1',
    groq: 'https://api.groq.com/openai/v1',
    mistral: 'https://api.mistral.ai/v1',
    perplexity: 'https://api.perplexity.ai',
    xai: 'https://api.x.ai/v1',
  };
  return urls[provider] || '';
}

function parseJsonResponse(content: string): LlmParsed | null {
  try {
    // Try direct parse
    return JSON.parse(content);
  } catch {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch { /* fall through */ }
    }
    // Try finding JSON object in text
    const braceMatch = content.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch { /* fall through */ }
    }
    console.warn('Failed to parse LLM response as JSON:', content.substring(0, 200));
    return null;
  }
}
