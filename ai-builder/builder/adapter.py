"""
Adapter Generator - 공통-프로젝트 어댑터 생성
"""
import os
import json
from typing import Dict, List, Optional
from dataclasses import dataclass

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../common/ai'))
from nvidia_client import get_client

@dataclass
class GeneratedAdapter:
    interface_path: str
    impl_path: str
    interface_content: str
    impl_content: str

class AdapterGenerator:
    """어댑터 자동 생성기"""
    
    PROMPT_TEMPLATE = """Generate Resonance framework adapter.

Common Module: {common_module}
Project: {project}
Contract: {contract_description}

Generate:
1. Interface in /common/adapters/{project}/
2. Implementation in /projects/{project}/adapter/

Follow Resonance adapter pattern:
- Interface extends ResAdapterContract
- Implementation has @ResAdapter annotation
- Configuration via YAML

Output JSON:
{{
  "interface_path": "path/to/interface.py",
  "impl_path": "path/to/impl.py",
  "interface_content": "...",
  "impl_content": "..."
}}
"""
    
    def __init__(self):
        self.client = get_client()
        
    def generate(self, common_module: str, project: str, contract_description: str) -> Optional[GeneratedAdapter]:
        """어댑터 생성"""
        prompt = self.PROMPT_TEMPLATE.format(
            common_module=common_module,
            project=project,
            contract_description=contract_description
        )
        
        response = self.client.call(prompt)
        if not response:
            return None
            
        return self._parse_response(response.content)
    
    def _parse_response(self, content: str) -> Optional[GeneratedAdapter]:
        """응답 파싱"""
        try:
            content = content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
                
            data = json.loads(content.strip())
            return GeneratedAdapter(
                interface_path=data.get("interface_path", ""),
                impl_path=data.get("impl_path", ""),
                interface_content=data.get("interface_content", ""),
                impl_content=data.get("impl_content", "")
            )
        except json.JSONDecodeError:
            return None
    
    def save(self, adapter: GeneratedAdapter) -> bool:
        """어댑터 저장"""
        try:
            root = "/opt/Resonance"
            
            if adapter.interface_path:
                full_path = os.path.join(root, adapter.interface_path)
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, "w") as f:
                    f.write(adapter.interface_content)
                    
            if adapter.impl_path:
                full_path = os.path.join(root, adapter.impl_path)
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, "w") as f:
                    f.write(adapter.impl_content)
                    
            return True
        except Exception:
            return False
