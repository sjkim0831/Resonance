"""
Code Generator - AI 기반 코드 생성
M2.7 모델 활용 + 자동 빌드 트리거
"""
import os
import sys
import json
import subprocess
import shutil
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../common/ai'))

from nvidia_client import get_client, NvidiaResponse

@dataclass
class GeneratedCode:
    file_path: str
    content: str
    language: str
    confidence: float

class CodeGenerator:
    """프레임워크 코드 자동 생성기 + 빌드 트리거"""

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

    def generate(self, type: str, context: Dict[str, Any], auto_save: bool = True,
                 commit: bool = False, build: bool = False) -> List[GeneratedCode]:
        """코드 생성 실행

        Args:
            type: 생성 타입 (adapter, module, service)
            context: 생성 컨텍스트
            auto_save: 생성 후 자동 저장 여부
            commit: 저장 후 git commit 여부
            build: 저장 후 Maven 빌드 트리거 여부
        """
        prompt = self._build_prompt(type, context)

        response = self.client.call(prompt)
        if not response:
            return []

        results = self._parse_response(response.content, context)

        if auto_save:
            for code in results:
                self.save(code)
            print(f"[CodeGenerator] Saved {len(results)} files")

        if commit:
            self._git_commit(results)

        if build and auto_save:
            self._trigger_build(results)

        return results

    def _build_prompt(self, type: str, context: Dict[str, Any]) -> str:
        """프롬프트 구성"""
        template = self.PROMPTS.get(type, self.PROMPTS["module"])
        return template.format(**context)

    def _parse_response(self, content: str, context: Dict[str, Any]) -> List[GeneratedCode]:
        """응답 파싱"""
        results = []
        try:
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
        except json.JSONDecodeError as e:
            print(f"[CodeGenerator] JSON parse error: {e}")
        return results

    def save(self, code: GeneratedCode) -> bool:
        """생성된 코드 저장"""
        try:
            full_path = os.path.join(self.project_root, code.file_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            if code.file_path.endswith('.java'):
                self._ensure_java_package_dir(code.content, full_path)

            with open(full_path, "w", encoding='utf-8') as f:
                f.write(code.content)

            print(f"[CodeGenerator] Saved: {code.file_path}")
            return True
        except Exception as e:
            print(f"[CodeGenerator] Save error for {code.file_path}: {e}")
            return False

    def _ensure_java_package_dir(self, content: str, file_path: str):
        """Java 파일의 package 디렉토리가 일치하는지 확인"""
        import re
        match = re.search(r'package\s+([\w.]+);', content)
        if match:
            expected_package = match.group(1).replace('.', '/')
            file_dir = os.path.dirname(file_path)
            if not file_dir.endswith(expected_package):
                target_dir = os.path.join(os.path.dirname(file_path), expected_package)
                os.makedirs(target_dir, exist_ok=True)
                target_file = os.path.join(target_dir, os.path.basename(file_path))
                if not os.path.exists(target_file):
                    shutil.move(file_path, target_file)

    def _git_commit(self, results: List[GeneratedCode]) -> bool:
        """변경된 파일들을 git commit"""
        try:
            files = [r.file_path for r in results if r.file_path]
            if not files:
                return False

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            commit_msg = f"AI generated code - {timestamp}"

            for f in files:
                subprocess.run(["git", "add", f], cwd=self.project_root, check=False)

            subprocess.run(
                ["git", "commit", "-m", commit_msg, "--allow-empty"],
                cwd=self.project_root,
                capture_output=True
            )
            print(f"[CodeGenerator] Committed: {commit_msg}")
            return True
        except Exception as e:
            print(f"[CodeGenerator] Git commit error: {e}")
            return False

    def _trigger_build(self, results: List[GeneratedCode]) -> Dict[str, Any]:
        """Maven 빌드 트리거"""
        try:
            has_java = any(r.file_path.endswith('.java') for r in results)
            has_python = any(r.file_path.endswith('.py') for r in results)

            if has_java:
                print("[CodeGenerator] Triggering Maven build...")
                result = subprocess.run(
                    ["mvn", "package", "-DskipTests", "-q"],
                    cwd=self.project_root,
                    capture_output=True,
                    text=True,
                    timeout=600
                )
                if result.returncode == 0:
                    print("[CodeGenerator] Maven build succeeded")
                    return {"status": "success", "type": "maven"}
                else:
                    print(f"[CodeGenerator] Maven build failed: {result.stderr[:500]}")
                    return {"status": "failed", "type": "maven", "error": result.stderr[:500]}

            if has_python:
                print("[CodeGenerator] No build needed for Python files")
                return {"status": "skipped", "type": "python"}

            return {"status": "skipped", "reason": "no_buildable_files"}

        except subprocess.TimeoutExpired:
            print("[CodeGenerator] Build timeout")
            return {"status": "timeout"}
        except Exception as e:
            print(f"[CodeGenerator] Build error: {e}")
            return {"status": "error", "error": str(e)}

    def generate_and_push(self, type: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """생성 → 저장 → 커밋 → 푸시 전체流程"""
        results = self.generate(type, context, auto_save=True, commit=True, build=True)
        if not results:
            return {"status": "no_results"}

        try:
            subprocess.run(
                ["git", "push"],
                cwd=self.project_root,
                capture_output=True,
                text=True
            )
            print("[CodeGenerator] Pushed to remote")
            return {"status": "success", "files": [r.file_path for r in results]}
        except Exception as e:
            print(f"[CodeGenerator] Push error: {e}")
            return {"status": "push_failed", "files": [r.file_path for r in results], "error": str(e)}

    def generate_adapter(self, common_module: str, project: str, project_specific: str,
                         auto_save: bool = True) -> List[GeneratedCode]:
        """어댑터 생성"""
        return self.generate("adapter", {
            "common_module": common_module,
            "project": project,
            "project_specific": project_specific,
            "language": "python"
        }, auto_save=auto_save)

    def generate_module(self, module_name: str, entity: str, operations: List[str],
                        language: str = "python", auto_save: bool = True) -> List[GeneratedCode]:
        """모듈 생성"""
        return self.generate("module", {
            "module_name": module_name,
            "entity": entity,
            "operations": ", ".join(operations),
            "language": language
        }, auto_save=auto_save)


if __name__ == "__main__":
    g = CodeGenerator()

    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "test":
            print("[CodeGenerator] Running test generate...")
            results = g.generate_module("TestModule", "User", ["create", "read", "update", "delete"])
            print(f"Generated {len(results)} files")
        elif cmd == "build":
            print("[CodeGenerator] Triggering Maven build...")
            result = g._trigger_build([])
            print(f"Build result: {result}")
    else:
        print("[CodeGenerator] Usage: python generator.py [test|build]")