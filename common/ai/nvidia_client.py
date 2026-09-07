"""
NVIDIA API Parallel Client
16 API Keys를 사용한 M2.7 병렬 처리 클라이언트
"""
import os
import time
import yaml
import json
import httpx
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

NVIDIA_API_KEYS_FILE_DEFAULT = "/etc/resonance/secrets/nvidia-api-keys"


def _load_api_keys() -> List[str]:
    """NVIDIA API 키를 환경변수/시크릿 파일에서 로드합니다 (코드에 하드코딩 금지).

    ops/scripts/import-hermes-nvidia-key-pool.py와 동일한 컨벤션:
    NVIDIA_API_KEYS_FILE 환경변수(기본값 /etc/resonance/secrets/nvidia-api-keys),
    한 줄에 키 하나씩 저장된 mode 0600 파일.
    """
    keys_file = Path(os.environ.get("NVIDIA_API_KEYS_FILE", NVIDIA_API_KEYS_FILE_DEFAULT))
    if not keys_file.is_file():
        raise RuntimeError(
            f"NVIDIA API 키 파일을 찾을 수 없습니다: {keys_file}. "
            "NVIDIA_API_KEYS_FILE 환경변수로 경로를 지정하거나 해당 경로에 파일을 생성하세요."
        )
    keys = [line.strip() for line in keys_file.read_text().splitlines() if line.strip()]
    if not keys:
        raise RuntimeError(f"NVIDIA API 키 파일이 비어 있습니다: {keys_file}")
    return keys


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
        self.keys = _load_api_keys()

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
