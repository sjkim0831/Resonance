import { useState, useCallback } from "react";
import {
  createAICompletion,
  generateEmissionAnalysis,
  generateComplianceReport,
  suggestReductionStrategies,
  analyzeDataQuality,
  generateEmissionForecast,
  type AIStreamCallback,
} from "./nvidiaApi";

export interface UseAIOptions {
  onChunk?: (text: string) => void;
  onComplete?: (text: string) => void;
  onError?: (error: Error) => void;
}

export function useAIStream() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<string>("");

  const generate = useCallback(async (
    prompt: string,
    options?: UseAIOptions
  ) => {
    setIsLoading(true);
    setError(null);
    setResult("");

    const callback: AIStreamCallback = {
      onChunk: (text) => {
        setResult((prev) => prev + text);
        options?.onChunk?.(text);
      },
      onComplete: (fullText) => {
        setResult(fullText);
        setIsLoading(false);
        options?.onComplete?.(fullText);
      },
      onError: (err) => {
        setError(err);
        setIsLoading(false);
        options?.onError?.(err);
      },
    };

    try {
      await createAICompletion(
        {
          model: "mistralai/mixtral-8x7b-instruct-v0.1",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1024,
          temperature: 0.5,
        },
        callback
      );
    } catch (err) {
      // Error handled in callback
    }
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setResult("");
  }, []);

  return { generate, isLoading, error, result, reset };
}

export async function analyzeEmissionSite(
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
  try {
    return await generateEmissionAnalysis(siteData, en);
  } catch (err) {
    console.error("AI analysis failed:", err);
    return en
      ? "Analysis temporarily unavailable. Please try again later."
      : "AI 분석을 일시적으로 이용하실 수 없습니다. 나중에 다시 시도해 주세요.";
  }
}

export async function getComplianceSummary(
  emissions: Array<{ scope: string; emission: string; target: string }>,
  en: boolean
): Promise<string> {
  try {
    return await generateComplianceReport(emissions, en);
  } catch (err) {
    console.error("Compliance report generation failed:", err);
    return en
      ? "Unable to generate compliance report at this time."
      : "현재 준수 보고서를 생성할 수 없습니다.";
  }
}

export async function getReductionSuggestions(
  currentEmissions: string,
  targetEmissions: string,
  scope: string,
  en: boolean
): Promise<string> {
  try {
    return await suggestReductionStrategies(currentEmissions, targetEmissions, scope, en);
  } catch (err) {
    console.error("Reduction strategy generation failed:", err);
    return en
      ? "Unable to generate reduction strategies at this time."
      : "현재 감축 전략을 생성할 수 없습니다.";
  }
}

export async function getDataQualityAnalysis(
  completeness: string,
  lastUpdated: string,
  verificationStatus: string,
  en: boolean
) {
  try {
    return await analyzeDataQuality(completeness, lastUpdated, verificationStatus, en);
  } catch (err) {
    console.error("Data quality analysis failed:", err);
    return {
      score: parseInt(completeness) || 75,
      issues: [],
      recommendations: en
        ? "Data quality analysis temporarily unavailable."
        : "데이터 품질 분석을 일시적으로 이용하실 수 없습니다.",
    };
  }
}

export async function getEmissionForecast(
  historicalData: Array<{ month: string; emission: number }>,
  en: boolean
) {
  try {
    return await generateEmissionForecast(historicalData, en);
  } catch (err) {
    console.error("Emission forecast failed:", err);
    return {
      nextMonth: historicalData[historicalData.length - 1]?.emission || 0,
      trend: "stable",
      confidence: 0.5,
    };
  }
}