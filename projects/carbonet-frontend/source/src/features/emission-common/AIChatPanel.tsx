import React, { useState, useRef, useEffect } from "react";
import { analyzeEmissionSite } from "../../lib/ai/useAIStream";

interface AIChatPanelProps {
  en: boolean;
  siteContext?: {
    siteId: string;
    siteName: string;
    currentEmission: string;
    targetEmission: string;
    status: string;
    dataCompleteness: string;
  };
  onClose?: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function AIChatPanel({ en, siteContext, onClose }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoAnalysisDone, setAutoAnalysisDone] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (siteContext && !autoAnalysisDone) {
      setIsAnalyzing(true);
      setAutoAnalysisDone(true);

      analyzeEmissionSite(siteContext, en).then((analysis) => {
        setMessages([
          {
            id: "initial-analysis",
            role: "assistant",
            content: en
              ? `I've analyzed the emission site ${siteContext.siteName} (${siteContext.siteId}). Here's my assessment:\n\n${analysis}`
              : `${siteContext.siteName} (${siteContext.siteId}) 배출 현장을 분석했습니다. 평가 결과:\n\n${analysis}`,
            timestamp: new Date(),
          },
        ]);
        setIsAnalyzing(false);
      });
    }
  }, [siteContext, en, autoAnalysisDone]);

  const handleSend = async () => {
    if (!input.trim() || isAnalyzing) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsAnalyzing(true);

    try {
      const { createAICompletion } = await import("../../lib/ai/nvidiaApi");

      const systemPrompt = en
        ? `You are an AI assistant specialized in carbon emission management. Provide helpful, accurate information in Korean or English about:
- Emission calculations and factors
- Regulatory compliance (KEMCO, GHG Protocol)
- Reduction strategies and recommendations
- Data analysis and quality assessment
- LCA and environmental impact

Keep responses concise and actionable.`
        : `당신은 탄소 배출 관리 전문가 AI 어시스턴트입니다. 다음 사항에 대해 한글로 정확하고 유용한 정보를 제공하세요:
- 배출량 계산 및 배출계수
- 규제 준수 (한국에너지공단, GHG 프로토콜)
- 감축 전략 및 권장 사항
- 데이터 분석 및 품질 평가
- 전과정평가(LCA) 및 환경 영향

응답은 간결하고 실행 가능하게 유지하세요.`;

      const response = await createAICompletion({
        model: "mistralai/mixtral-8x7b-instruct-v0.1",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: input.trim() },
        ],
        max_tokens: 800,
        temperature: 0.5,
      });

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: en
          ? "I encountered an error processing your request. Please try again."
          : "요청을 처리하는 중 오류가 발생했습니다. 다시 시도해 주세요.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = en
    ? [
        "What are the main emission sources?",
        "How can we reduce emissions by 10%?",
        "What data is missing?",
        "Is the site compliant with regulations?",
      ]
    : [
        "주요 배출원은 무엇인가요?",
        "배출량을 10% 감축하려면 어떻게 해야 하나요?",
        "어떤 데이터가 누락되었나요?",
        "해당 현장은 규제 준수 상태인가요?",
      ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl flex flex-col h-[500px] max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[18px]">smart_toy</span>
          </div>
          <div>
            <div className="font-bold text-white text-sm">
              {en ? "AI Emission Assistant" : "AI 배출량 어시스턴트"}
            </div>
            <div className="text-white/70 text-[10px]">
              {en ? "Powered by NVIDIA AI" : "엔비디아 AI 기반"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
          aria-label={en ? "Close" : "닫기"}
        >
          <span className="material-symbols-outlined text-white text-[18px]">close</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isAnalyzing && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-indigo-500 text-3xl">psychology</span>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              {en
                ? "Ask me anything about emission management, compliance, or reduction strategies."
                : "배출량 관리, 규제 준수 또는 감축 전략에 대해 질문해 주세요."}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setInput(q);
                    inputRef.current?.focus();
                  }}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {isAnalyzing && messages.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-500 text-sm">
                {en ? "Analyzing..." : "분석 중..."}
              </span>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-indigo-500 text-white rounded-br-md"
                  : "bg-gray-100 text-gray-800 rounded-bl-md"
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              <p
                className={`text-[10px] mt-1 ${
                  message.role === "user" ? "text-white/60" : "text-gray-400"
                }`}
              >
                {message.timestamp.toLocaleTimeString(en ? "en-US" : "ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {isAnalyzing && messages.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-500 text-sm">
                  {en ? "Thinking..." : "생각 중..."}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={en ? "Ask about emissions..." : "배출량에 대해 질문하세요..."}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            rows={1}
            disabled={isAnalyzing}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isAnalyzing}
            className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-white text-[20px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface AIInsightCardProps {
  en: boolean;
  type: "analysis" | "forecast" | "recommendation" | "alert";
  title: string;
  content: string;
  confidence?: number;
  onAction?: () => void;
}

export function AIInsightCard({
  en,
  type,
  title,
  content,
  confidence,
  onAction,
}: AIInsightCardProps) {
  const icons = {
    analysis: "analytics",
    forecast: "timeline",
    recommendation: "lightbulb",
    alert: "warning",
  };

  const colors = {
    analysis: "from-blue-500 to-indigo-500",
    forecast: "from-emerald-500 to-teal-500",
    recommendation: "from-amber-500 to-orange-500",
    alert: "from-red-500 to-rose-500",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${colors[type]}`} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg bg-gradient-to-r ${colors[type]} flex items-center justify-center shrink-0`}
          >
            <span className="material-symbols-outlined text-white text-[20px]">{icons[type]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-gray-900 text-sm">{title}</h4>
              {confidence !== undefined && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
                  {Math.round(confidence * 100)}%
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{content}</p>
          </div>
        </div>
        {onAction && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onAction}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              {en ? "View Details" : "자세히 보기"}
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}