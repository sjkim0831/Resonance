"""
Page Generator - React 페이지 자동 생성 + SDUI 메타데이터 연동
"""
import os
import json
import subprocess
from datetime import datetime
from typing import Dict, List, Optional, Tuple
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

@dataclass
class GeneratedSDUI:
    screen_id: str
    metadata: Dict
    route_path: str

class PageGenerator:
    """React 페이지 자동 생성기 + SDUI 연동"""

    SOURCE_PROMPT_TEMPLATE = """Generate a React page for {project}.

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

    SDUI_PROMPT_TEMPLATE = """Generate SDUI (Server-Driven UI) metadata for a page.

Page: {page_name}
Route: {route}
Description: {description}
Entity: {entity}

Generate a JSON metadata structure with:
- screenId: unique identifier
- components: array of UI components with type, properties, events
- layout: zone layout configuration
- dataBinding: entity fields and API mappings
- permissions: required access levels

Output JSON:
{{"screenId": "...", "components": [...], "layout": {{}}, "dataBinding": {{}}, "permissions": []}}
"""

    def __init__(self):
        self.client = get_client()
        self.project_root = "/opt/Resonance"
        self.pages_path = os.path.join(self.project_root, "projects/{project}/pages")
        self.sdui_path = os.path.join(self.project_root, "projects/carbonet-backend-metadata/screens")
        self.build_script = os.path.join(self.project_root, "ops/scripts/resonance-no-build-apply.sh")

    def generate(self, project: str, page_name: str, description: str, entity: str,
                 generate_sdui: bool = True, apply_sdui: bool = False) -> Optional[Tuple[GeneratedPage, Optional[GeneratedSDUI]]]:
        """페이지 + SDUI 생성

        Args:
            project: 프로젝트명
            page_name: 페이지 이름
            description: 페이지 설명
            entity: 데이터 엔티티
            generate_sdui: SDUI 메타데이터 생성 여부
            apply_sdui: SDUI 즉시 적용 여부
        """
        source_prompt = self.SOURCE_PROMPT_TEMPLATE.format(
            project=project,
            page_name=page_name,
            description=description,
            entity=entity
        )

        source_response = self.client.call(source_prompt)
        if not source_response:
            print("[PageGenerator] No source response")
            return None

        page = self._parse_response(source_response.content)
        if not page:
            print("[PageGenerator] Failed to parse page response")
            return None

        sdui = None
        if generate_sdui:
            sdui_prompt = self.SDUI_PROMPT_TEMPLATE.format(
                page_name=page_name,
                route=page.route,
                description=description,
                entity=entity
            )
            sdui_response = self.client.call(sdui_prompt)
            if sdui_response:
                sdui = self._parse_sdui(sdui_response.content, page.route)

        if not self.save(project, page):
            print("[PageGenerator] Failed to save page")
            return None

        print(f"[PageGenerator] Saved page: {page.route}")

        if sdui and not self.save_sdui(sdui):
            print("[PageGenerator] Failed to save SDUI metadata")

        if apply_sdui and sdui:
            self.apply_sdui(sdui)

        return (page, sdui)

    def _parse_response(self, content: str) -> Optional[GeneratedPage]:
        """소스 응답 파싱"""
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
                style=data.get("style"),
                content=data.get("content", data.get("component", ""))
            )
        except json.JSONDecodeError as e:
            print(f"[PageGenerator] JSON parse error: {e}")
            return None

    def _parse_sdui(self, content: str, route: str) -> Optional[GeneratedSDUI]:
        """SDUI 메타데이터 파싱"""
        try:
            content = content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            data = json.loads(content.strip())

            route_path = data.get("routePath", route)
            screen_id = data.get("screenId", route.replace("/", "_").replace("-", "_"))

            return GeneratedSDUI(
                screen_id=screen_id,
                metadata=data,
                route_path=route_path
            )
        except json.JSONDecodeError as e:
            print(f"[PageGenerator] SDUI parse error: {e}")
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

            component = page.content if page.content else page.component
            with open(full_path, "w", encoding='utf-8') as f:
                f.write(component)

            if page.style:
                style_path = full_path.replace(".tsx", ".css")
                with open(style_path, "w", encoding='utf-8') as f:
                    f.write(page.style)

            print(f"[PageGenerator] Saved: {full_path}")
            return True
        except Exception as e:
            print(f"[PageGenerator] Save error: {e}")
            return False

    def save_sdui(self, sdui: GeneratedSDUI) -> bool:
        """SDUI 메타데이터 저장"""
        try:
            os.makedirs(self.sdui_path, exist_ok=True)

            filename = f"{sdui.screen_id}.json"
            filepath = os.path.join(self.sdui_path, filename)

            with open(filepath, "w", encoding='utf-8') as f:
                json.dump(sdui.metadata, f, indent=2, ensure_ascii=False)

            print(f"[PageGenerator] Saved SDUI: {filepath}")
            return True
        except Exception as e:
            print(f"[PageGenerator] SDUI save error: {e}")
            return False

    def apply_sdui(self, sdui: GeneratedSDUI) -> bool:
        """SDUI 메타데이터 즉시 적용"""
        try:
            if os.path.exists(self.build_script):
                result = subprocess.run(
                    [self.build_script, "apply"],
                    cwd=self.project_root,
                    capture_output=True,
                    text=True,
                    timeout=120
                )
                if result.returncode == 0:
                    print("[PageGenerator] SDUI applied successfully")
                    return True
                else:
                    print(f"[PageGenerator] SDUI apply failed: {result.stderr[:500]}")
                    return False
            else:
                print(f"[PageGenerator] Build script not found: {self.build_script}")
                return False
        except Exception as e:
            print(f"[PageGenerator] SDUI apply error: {e}")
            return False

    def list_pages(self, project: str) -> List[str]:
        """생성된 페이지 목록"""
        try:
            pages_dir = self.pages_path.format(project=project)
            if not os.path.exists(pages_dir):
                return []
            return [f for f in os.listdir(pages_dir) if f.endswith('.tsx')]
        except Exception:
            return []

    def delete_page(self, project: str, page_name: str) -> bool:
        """페이지 삭제"""
        try:
            filepath = os.path.join(
                self.pages_path.format(project=project),
                page_name if page_name.endswith('.tsx') else page_name + '.tsx'
            )
            if os.path.exists(filepath):
                os.remove(filepath)
                print(f"[PageGenerator] Deleted: {filepath}")
                return True
            return False
        except Exception as e:
            print(f"[PageGenerator] Delete error: {e}")
            return False


if __name__ == "__main__":
    g = PageGenerator()

    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "list":
            pages = g.list_pages("carbonet-frontend")
            print(f"Pages: {len(pages)}")
            for p in pages[:10]:
                print(f"  - {p}")
        elif cmd == "test":
            print("[PageGenerator] Running test generate...")
            result = g.generate(
                "carbonet-frontend",
                "TestPage",
                "Test description",
                "User"
            )
            if result:
                print(f"Generated: {result[0].route}")
    else:
        print("[PageGenerator] Usage: python page.py [list|test]")