"""
NVIDIA API Parallel Client
16 API Keys로 M2.7 모델 병렬 처리
"""
import os
import time
import yaml
import json
import httpx
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

NVIDIA_API_KEYS = [
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
]

@dataclass
class NvidiaResponse:
    content: str
    model: str
    usage: Dict[str, int]
    status: int

class NvidiaParallelClient:
    """16 API Keys를 사용하는 병렬 NVIDIA API 클라이언트"""
    
    def __init__(self, model: str = "minimaxai/minimax-m2.7", max_tokens: int = 4096, temperature: float = 0.3):
        self.endpoint = "https://integrate.api.nvidia.com/v1/chat/completions"
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.key_index = 0
        self.keys = NVIDIA_API_KEYS
        
    def _get_next_key(self) -> str:
        """Round-robin으로 API Key 반환"""
        key = self.keys[self.key_index % len(self.keys)]
        self.key_index += 1
        return key
    
    def call(self, prompt: str, retries: int = 3, delay: int = 5) -> Optional[NvidiaResponse]:
        """단일 API 호출"""
        for attempt in range(retries):
            try:
                response = httpx.post(
                    self.endpoint,
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": self.max_tokens,
                        "temperature": self.temperature
                    },
                    headers={"Authorization": f"Bearer {self._get_next_key()}"},
                    timeout=60.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return NvidiaResponse(
                        content=data["choices"][0]["message"]["content"],
                        model=data.get("model", self.model),
                        usage=data.get("usage", {}),
                        status=200
                    )
                elif response.status_code == 429:
                    time.sleep(delay * (2 ** attempt))
                    continue
                else:
                    return None
            except Exception as e:
                if attempt < retries - 1:
                    time.sleep(delay)
                    continue
                return None
        return None
    
    def parallel_call(self, prompts: List[str], max_workers: int = 16) -> List[Optional[NvidiaResponse]]:
        """병렬 API 호출"""
        results = []
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(self.call, p): i for i, p in enumerate(prompts)}
            for future in as_completed(futures):
                results.append(future.result())
        return results

# Singleton instance
_client = None

def get_client() -> NvidiaParallelClient:
    global _client
    if _client is None:
        _client = NvidiaParallelClient()
    return _client
