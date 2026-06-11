"""
Page Generator - React 페이지 자동 생성
"""
import os
import json
from typing import Dict, List, Optional
from dataclasses import dataclass

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../common/ai'))
from nvidia_client import get_client

@dataclass
class GeneratedPage:
    route: str
    component: str
    content: str
    style: Optional[str] = None

class PageGenerator:
    """React 페이지 자동 생성기"""
    
    PROMPT_TEMPLATE = """Generate a React page for {project}.

Page: {page_name}
Description: {description}
Data Entity: {entity}

Requirements:
- Use TypeScript + React
- Use existing UI components from /common/ui
- Follow framework conventions
- Include CRUD operations if needed
- Use Tailwind CSS

Output JSON:
{{"route": "/path", "component": "...tsx code...", "style": "...css if needed..."}}
"""
    
    def __init__(self):
        self.client = get_client()
        self.pages_path = "/opt/Resonance/projects/{project}/pages"
        
    def generate(self, project: str, page_name: str, description: str, entity: str) -> Optional[GeneratedPage]:
        """페이지 생성"""
        prompt = self.PROMPT_TEMPLATE.format(
            project=project,
            page_name=page_name,
            description=description,
            entity=entity
        )
        
        response = self.client.call(prompt)
        if not response:
            return None
            
        return self._parse_response(response.content)
    
    def _parse_response(self, content: str) -> Optional[GeneratedPage]:
        """응답 파싱"""
        try:
            content = content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
                
            data = json.loads(content.strip())
            return GeneratedPage(
                route=data.get("route", "/"),
                component=data.get("component", ""),
                style=data.get("style")
            )
        except json.JSONDecodeError:
            return None
    
    def save(self, project: str, page: GeneratedPage) -> bool:
        """페이지 저장"""
        try:
            route_path = page.route.lstrip("/").replace("/", "_")
            if not route_path.endswith(".tsx"):
                route_path += ".tsx"
                
            full_path = os.path.join(
                self.pages_path.format(project=project),
                route_path
            )
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w") as f:
                f.write(page.component)
            return True
        except Exception:
            return False
