import { apiFetch, buildAdminApiPath } from "../api/core";

export interface AIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionOptions {
  model?: string;
  messages?: AIChatMessage[];
  prompt?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface AIStreamCallback {
  onChunk?: (text: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Calls the server-side NVIDIA NIM proxy (POST /admin/ai/chat/completions) instead of
 * NVIDIA's API directly from the browser. API keys never reach the client - the backend
 * holds the key pool (see NimKeyPoolClient.java) and forwards the request. The proxy is
 * currently non-streaming, so `onChunk` fires once with the full text rather than
 * token-by-token; `onComplete`/`onError` behave the same as before.
 */
export async function createAICompletion(
  options: AICompletionOptions,
  callback?: AIStreamCallback
): Promise<string> {
  const model = options.model || "mistralai/mixtral-8x7b-instruct-v0.1";

  const requestBody: Record<string, unknown> = {
    model,
    temperature: options.temperature ?? 0.5,
    max_tokens: options.max_tokens ?? 1024,
    top_p: options.top_p ?? 0.95,
    frequency_penalty: options.frequency_penalty ?? 0,
    presence_penalty: options.presence_penalty ?? 0,
  };

  if (options.messages) {
    requestBody.messages = options.messages;
  } else if (options.prompt) {
    requestBody.prompt = options.prompt;
  }

  try {
    const response = await apiFetch(buildAdminApiPath("/admin/ai/chat/completions"), {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI chat completion error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    callback?.onChunk?.(content);
    callback?.onComplete?.(content);
    return content;
  } catch (error) {
    callback?.onError?.(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function generateEmissionAnalysis(
  siteData: {
    siteId: string;
    siteName: string;
    currentEmission: string;
    targetEmission: string;
    status: string;
    dataCompleteness: string;
  },
  en: boolean
): Promise<string> {
  const systemPrompt = en
    ? `You are an AI assistant specialized in carbon emission analysis. Analyze the provided site data and provide actionable insights in Korean or English. Focus on:
1. Emission reduction recommendations
2. Data quality improvements
3. Compliance status analysis
4. Risk assessment and alerts`

    : `당신은 탄소 배출 분석 전문가 AI 어시스턴트입니다. 제공된 현장 데이터를 분석하고 다음 사항에 중점을 맞춰 한글로 실행 가능한 인사이트를 제공하세요:
1. 배출 감축 권장 사항
2. 데이터 품질 개선
3. 규제 준수 상태 분석
4. 위험 평가 및 경보`;

  const userPrompt = en
    ? `Analyze this emission site:
Site ID: ${siteData.siteId}
Name: ${siteData.siteName}
Current Emission: ${siteData.currentEmission} tCO₂
Target: ${siteData.targetEmission} tCO₂
Status: ${siteData.status}
Data Completeness: ${siteData.dataCompleteness}

Provide a brief analysis with recommendations.`
    : `다음 배출 현장을 분석하세요:
시설 코드: ${siteData.siteId}
명칭: ${siteData.siteName}
현재 배출량: ${siteData.currentEmission} tCO₂
목표: ${siteData.targetEmission} tCO₂
상태: ${siteData.status}
데이터 완전성: ${siteData.dataCompleteness}

분석 및 권장 사항을简要적으로 제공하세요.`;

  return createAICompletion({
    model: "mistralai/mixtral-8x7b-instruct-v0.1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 512,
    temperature: 0.3,
  });
}

export async function generateComplianceReport(
  emissions: Array<{ scope: string; emission: string; target: string }>,
  en: boolean
): Promise<string> {
  const systemPrompt = en
    ? `You are an AI assistant for regulatory compliance reporting. Generate compliance summaries in Korean. Focus on KEMCO requirements and local regulations.`
    : `당신은 규제 준수 보고서를 작성하는 AI 어시스턴트입니다. 한국에너지공단(KEMCO) 요구 사항 및 지역 규정에 중점을 맞춰 한글 준수 보고서를 생성하세요.`;

  const userPrompt = en
    ? `Generate a compliance summary for these emissions:\n${emissions.map(e => `${e.scope}: ${e.emission} vs target ${e.target}`).join("\n")}`
    : `다음 배출량에 대한 준수 요약서를 생성하세요:\n${emissions.map(e => `${e.scope}: ${e.emission} (목표: ${e.target})`).join("\n")}`;

  return createAICompletion({
    model: "mistralai/mixtral-8x7b-instruct-v0.1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 768,
    temperature: 0.3,
  });
}

export async function suggestReductionStrategies(
  currentEmissions: string,
  targetEmissions: string,
  scope: string,
  en: boolean
): Promise<string> {
  const systemPrompt = en
    ? `You are an AI expert in carbon emission reduction strategies. Provide actionable, specific recommendations in Korean or English.`
    : `당신은 탄소 배출 감축 전략 전문가입니다. 구체적이고 실행 가능한 권장 사항을 한글로 제공하세요.`;

  const userPrompt = en
    ? `Suggest reduction strategies for ${scope} emissions.
Current: ${currentEmissions} tCO₂
Target: ${targetEmissions} tCO₂
Provide 3-5 specific, actionable recommendations.`
    : `${scope} 배출량을 감축하기 위한 전략을 제안하세요.
현재: ${currentEmissions} tCO₂
목표: ${targetEmissions} tCO₂
구체적이고 실행 가능한 권장 사항 3-5가지를 제공하세요.`;

  return createAICompletion({
    model: "mistralai/mixtral-8x7b-instruct-v0.1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 600,
    temperature: 0.4,
  });
}

export async function analyzeDataQuality(
  completeness: string,
  lastUpdated: string,
  verificationStatus: string,
  en: boolean
): Promise<{ score: number; issues: string[]; recommendations: string }> {
  const systemPrompt = en
    ? `You are a data quality analyst for emission monitoring. Analyze data completeness and provide a score (0-100) with issues and recommendations in Korean.`
    : `당신은 배출 모니터링 데이터 품질 분석가입니다. 데이터 완전성을 분석하고 문제점과 권장 사항을 한글트로 제공하세요.`;

  const userPrompt = en
    ? `Analyze data quality:
- Completeness: ${completeness}
- Last Updated: ${lastUpdated}
- Verification: ${verificationStatus}

Provide a quality score (0-100), list any issues, and give recommendations.`
    : `데이터 품질을 분석하세요:
- 완전성: ${completeness}
- 최종 업데이트: ${lastUpdated}
- 검증 상태: ${verificationStatus}

품질 점수(0-100), 문제점 목록, 권장 사항을 제공하세요.`;

  const result = await createAICompletion({
    model: "mistralai/mixtral-8x7b-instruct-v0.1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 500,
    temperature: 0.2,
  });

  const scoreMatch = result.match(/(\d+)%?|(\d+)\/100/);
  const score = scoreMatch ? parseInt(scoreMatch[1] || scoreMatch[2]) : 75;

  const issues: string[] = [];
  if (parseInt(completeness) < 80) issues.push(en ? "Low data completeness" : "데이터 완전성 낮음");
  if (verificationStatus.includes("pending") || verificationStatus.includes("대기"))
    issues.push(en ? "Verification pending" : "검증 대기중");

  return {
    score: isNaN(score) ? 75 : score,
    issues,
    recommendations: result,
  };
}

export async function generateEmissionForecast(
  historicalData: Array<{ month: string; emission: number }>,
  en: boolean
): Promise<{ nextMonth: number; trend: string; confidence: number }> {
  const systemPrompt = en
    ? `You are an AI analyst specializing in emission forecasting. Analyze historical data and predict next month's emission levels.`
    : `당신은 배출량 예측 전문가 AI 분석가입니다. 과거 데이터를 분석하고 다음 달 배출량을 예측하세요.`;

  const history = historicalData.map(d => `${d.month}: ${d.emission} tCO₂`).join(", ");

  const userPrompt = en
    ? `Based on this historical data: ${history}
Predict next month's emission level and trend.`
    : `다음 과거 데이터를 기반으로: ${history}
다음 달 배출량과 트렌드를 예측하세요.`;

  const result = await createAICompletion({
    model: "mistralai/mixtral-8x7b-instruct-v0.1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 300,
    temperature: 0.2,
  });

  const numMatch = result.match(/\d+/);
  const nextMonth = numMatch ? parseInt(numMatch[0]) : historicalData[historicalData.length - 1]?.emission || 0;
  const trend = result.toLowerCase().includes("increase") || result.includes("증가") ? "increasing" : "decreasing";

  return {
    nextMonth,
    trend,
    confidence: 0.75,
  };
}
