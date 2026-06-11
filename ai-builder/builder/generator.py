"""
Code Generator - AI 기반 코드 생성
M2.7 모델 활용
"""
import os
import sys
import json
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

# Add common/ai to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../common/ai'))

from nvidia_client import get_client, NvidiaResponse

@dataclass
class GeneratedCode:
    file_path: str
    content: str
    language: str
    confidence: float

class CodeGenerator:
    """프레임워크 코드 자동 생성기"""
    
    PROMPTS = {
        "adapter": """You are a {language} expert. Generate an adapter file for {project} project.

Context:
- Common module: {common_module}
- Project specific: {project_specific}
- Framework: Resonance (Spring Boot + React)

Generate a {language} adapter that:
1. Connects common module to project
2. Implements required interfaces
3. Follows framework conventions

Output JSON:
{{"file_path": "path/to/adapter.{ext}", "content": "..."}}
""",
        "module": """You are a {language} expert. Generate a module for {project}.

Context:
- Module name: {module_name}
- Entity: {entity}
- Operations: {operations}

Generate a complete {language} module with:
1. Interface definition
2. Implementation
3. Configuration

Output JSON:
{{"file_path": "...", "content": "..."}}
""",
        "service": """You are a Python/Java/TypeScript expert. Generate a service class.

Context:
- Name: {name}
- Responsibilities: {responsibilities}
- Dependencies: {dependencies}

Generate a service class following {language} best practices and framework conventions.

Output JSON:
{{"file_path": "...", "content": "..."}}
"""
    }
    
    def __init__(self):
        self.client = get_client()
        self.project_root = "/opt/Resonance"
        self.common_path = os.path.join(self.project_root, "common")
        self.projects_path = os.path.join(self.project_root, "projects")
        
    def generate(self, type: str, context: Dict[str, Any]) -> List[GeneratedCode]:
        """코드 생성 실행"""
        prompt = self._build_prompt(type, context)
        response = self.client.call(prompt)
        
        if not response:
            return []
            
        return self._parse_response(response.content, context)
    
    def _build_prompt(self, type: str, context: Dict[str, Any]) -> str:
        """프롬프트 구성"""
        template = self.PROMPTS.get(type, self.PROMPTS["module"])
        return template.format(**context)
    
    def _parse_response(self, content: str, context: Dict[str, Any]) -> List[GeneratedCode]:
        """응답 파싱"""
        results = []
        try:
            # JSON 부분 추출
            content = content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
                
            data = json.loads(content.strip())
            if isinstance(data, list):
                for item in data:
                    results.append(GeneratedCode(
                        file_path=item.get("file_path", ""),
                        content=item.get("content", ""),
                        language=context.get("language", "python"),
                        confidence=0.85
                    ))
            else:
                results.append(GeneratedCode(
                    file_path=data.get("file_path", ""),
                    content=data.get("content", ""),
                    language=context.get("language", "python"),
                    confidence=0.85
                ))
        except json.JSONDecodeError:
            pass
        return results
    
    def save(self, code: GeneratedCode) -> bool:
        """생성된 코드 저장"""
        try:
            full_path = os.path.join(self.project_root, code.file_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w") as f:
                f.write(code.content)
            return True
        except Exception:
            return False
    
    def generate_adapter(self, common_module: str, project: str, project_specific: str) -> List[GeneratedCode]:
        """어댑터 생성"""
        return self.generate("adapter", {
            "common_module": common_module,
            "project": project,
            "project_specific": project_specific,
            "language": "python"
        })
    
    def generate_module(self, module_name: str, entity: str, operations: List[str], language: str = "python") -> List[GeneratedCode]:
        """모듈 생성"""
        return self.generate("module", {
            "module_name": module_name,
            "entity": entity,
            "operations": ", ".join(operations),
            "language": language
        })
