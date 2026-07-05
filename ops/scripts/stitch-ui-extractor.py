#!/usr/bin/env python3
"""
Stitch UI Extractor - SDUI Design System Extractor
대상 페이지의 UI 디자인 요소를 추출하여 SDUI 메타데이터로 변환
"""

import json
import re
import sys
from pathlib import Path
from datetime import datetime
from collections import defaultdict

class StitchUIExtractor:
    def __init__(self, output_dir="/opt/Resonance/projects/carbonet-backend-metadata/screens"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.design_tokens = {}
        self.component_registry = {}
        
    def extract_design_tokens(self, css_content):
        """CSS에서 디자인 토큰 추출 (var(--*) 패턴)"""
        tokens = {}
        
        # CSS 변수 추출
        var_patterns = [
            r'--([a-zA-Z0-9-]+):\s*([^;]+);',  # CSS custom properties
            r'color:\s*(#[a-fA-F0-9]{3,8}|rgb[a]?\([^)]+\)|rgba?\([^)]+\))',  # Colors
            r'background[-color]*:\s*([^;]+)',  # Backgrounds
            r'border[-radius]*:\s*([^;]+)',  # Borders
            r'spacing:\s*([^;]+)',  # Spacing
        ]
        
        for match in re.finditer(r'--([a-zA-Z0-9-]+):\s*([^;!]+)', css_content):
            key, value = match.groups()
            tokens[key] = value.strip()
            
        return tokens
    
    def extract_component_patterns(self, html_content):
        """HTML에서 컴포넌트 패턴 추출"""
        components = []
        
        # 컴포넌트 태그 분석
        tag_pattern = r'<([a-z]+)([^>]*)>'
        
        for match in re.finditer(tag_pattern, html_content):
            tag = match.group(1).lower()
            attrs = match.group(2)
            
            # class 추출
            class_match = re.search(r'class=["\']([^"\']+)["\']', attrs)
            classes = class_match.group(1).split() if class_match else []
            
            # id 추출
            id_match = re.search(r'id=["\']([^"\']+)["\']', attrs)
            element_id = id_match.group(1) if id_match else None
            
            # data-* 속성 추출
            data_attrs = dict(re.findall(r'data-([a-z-]+)=["\']([^"\']+)["\']', attrs))
            
            components.append({
                'tag': tag,
                'classes': classes,
                'id': element_id,
                'dataAttrs': data_attrs,
                'hasChildren': '</' + tag in html_content[match.start():match.end()+500]
            })
            
        return components
    
    def classify_component_type(self, tag, classes, data_attrs):
        """컴포넌트 유형 분류"""
        classes_lower = [c.lower() for c in classes]
        class_str = ' '.join(classes_lower)
        
        # Button
        if tag == 'button' or 'btn' in class_str:
            return 'BUTTON'
        
        # Input
        if tag in ('input', 'textarea', 'select'):
            if tag == 'input':
                input_type = re.search(r'type=["\'](\w+)["\']', str(data_attrs))
                return f"INPUT_{input_type.group(1).upper() if input_type else 'TEXT'}"
            return f"INPUT_{tag.upper()}"
        
        # Table
        if tag == 'table' or 'table' in class_str:
            return 'TABLE'
        
        # Card
        if 'card' in class_str:
            return 'CARD'
        
        # Modal/Dialog
        if 'modal' in class_str or 'dialog' in class_str:
            return 'MODAL'
        
        # Navigation
        if tag in ('nav', 'menu') or 'nav' in class_str or 'menu' in class_str:
            return 'NAVIGATION'
        
        # Form
        if tag == 'form':
            return 'FORM'
        
        # Header/Footer
        if tag in ('header', 'footer'):
            return f"LAYOUT_{tag.upper()}"
        
        # Section
        if tag in ('section', 'article', 'aside'):
            return f"LAYOUT_{tag.upper()}"
        
        # List
        if tag in ('ul', 'ol'):
            return 'LIST'
        
        # Badge
        if 'badge' in class_str:
            return 'BADGE'
        
        # Alert
        if 'alert' in class_str or 'toast' in class_str:
            return 'ALERT'
        
        # Tabs
        if 'tab' in class_str:
            return 'TABS'
        
        # Pagination
        if 'pagination' in class_str:
            return 'PAGINATION'
        
        # Chart
        if 'chart' in class_str or 'graph' in class_str:
            return 'CHART'
        
        # Icon
        if tag == 'i' or 'icon' in class_str:
            return 'ICON'
        
        # Image
        if tag in ('img', 'svg', 'picture'):
            return 'MEDIA'
        
        # Link
        if tag == 'a':
            return 'LINK'
        
        # Default
        return 'ELEMENT'
    
    def detect_design_system(self, classes):
        """디자인 시스템 감지 (gov-*, tailwind 등)"""
        classes_str = ' '.join(classes)
        
        return {
            'usesGov': any(c.startswith('gov-') for c in classes),
            'usesTailwind': bool(re.search(r'\b(bg-|text-|border-|flex|grid|p-|m-|rounded|shadow)', classes_str)),
            'usesBootstrap': any(c.startswith('col-') or c.startswith('row') or c in ('container', 'btn') for c in classes),
            'usesMaterial': any(c.startswith('mat-') or 'material' in classes_str for c in classes),
            'custom': not any([
                any(c.startswith('gov-') for c in classes),
                bool(re.search(r'\b(bg-|text-|border-|flex|grid|p-|m-)', classes_str))
            ])
        }
    
    def extract_accessibility(self, html_content, tag, attrs):
        """접근성属性 추출"""
        result = {}
        
        # ARIA roles
        role_match = re.search(r'role=["\']([^"\']+)["\']', attrs)
        if role_match:
            result['role'] = role_match.group(1)
        
        # Aria labels
        aria_label = re.search(r'aria-label=["\']([^"\']+)["\']', attrs)
        if aria_label:
            result['ariaLabel'] = aria_label.group(1)
        
        # Tab index
        tab_index = re.search(r'tabindex=["\'](\d+)["\']', attrs)
        if tab_index:
            result['tabIndex'] = int(tab_index.group(1))
        
        # Hidden
        if 'hidden' in attrs or 'display:none' in attrs:
            result['hidden'] = True
            
        return result
    
    def build_sdui_component(self, component_data, children=None):
        """SDUI 컴포넌트 메타데이터 생성"""
        return {
            'componentId': f"COMP_{component_data['tag'].upper()}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            'componentType': component_data['type'],
            'tag': component_data['tag'],
            'className': ' '.join(component_data['classes']) if component_data['classes'] else None,
            'selector': component_data['selector'],
            'props': {
                'className': ' '.join(component_data['classes']) if component_data['classes'] else '',
                'id': component_data.get('id'),
                'data-testid': component_data.get('dataAttrs', {}).get('testid'),
                **component_data.get('accessibility', {})
            },
            'children': children or [],
            'designSystem': component_data.get('designSystem'),
            'metadata': {
                'extractedAt': datetime.now().isoformat(),
                'source': 'stitch-ui-extractor'
            }
        }
    
    def generate_design_system_report(self, components):
        """디자인 시스템 분석 리포트 생성"""
        report = {
            'generatedAt': datetime.now().isoformat(),
            'summary': {
                'totalComponents': len(components),
                'componentTypes': defaultdict(int),
                'designSystems': defaultdict(int)
            },
            'designTokens': self.design_tokens,
            'componentRegistry': self.component_registry,
            'components': []
        }
        
        for comp in components:
            report['summary']['componentTypes'][comp['type']] += 1
            for ds, used in comp.get('designSystem', {}).items():
                if used:
                    report['summary']['designSystems'][ds] += 1
                    
            report['components'].append({
                'type': comp['type'],
                'tag': comp['tag'],
                'classes': comp['classes'],
                'selector': comp['selector']
            })
            
        return report
    
    def save_sdui_metadata(self, page_id, data):
        """SDUI 메타데이터 저장"""
        output_file = self.output_dir / f"{page_id}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"[Stitch] Saved: {output_file}")
        return output_file

def main():
    if len(sys.argv) < 2:
        print("Usage: python stitch-ui-extractor.py <page_id> [--html-file <file>] [--css-file <file>]")
        print("       python stitch-ui-extractor.py --batch <directory>")
        sys.exit(1)
    
    extractor = StitchUIExtractor()
    
    if sys.argv[1] == '--batch':
        batch_dir = sys.argv[2] if len(sys.argv) > 2 else './html'
        print(f"[Stitch] Batch processing: {batch_dir}")
        
        html_files = list(Path(batch_dir).glob('*.html'))
        for html_file in html_files:
            with open(html_file, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            page_id = html_file.stem
            components = extractor.extract_component_patterns(html_content)
            
            # Process and classify components
            processed = []
            for comp in components:
                comp['type'] = extractor.classify_component_type(
                    comp['tag'], comp['classes'], comp.get('dataAttrs', {})
                )
                comp['designSystem'] = extractor.detect_design_system(comp['classes'])
                comp['selector'] = f"{comp['tag']}{'#' + comp['id'] if comp['id'] else ''}"
                
                processed.append(comp)
            
            report = extractor.generate_design_system_report(processed)
            extractor.save_sdui_metadata(page_id, report)
            
    elif sys.argv[1] == '--html-file' and len(sys.argv) > 3:
        html_file = sys.argv[2]
        page_id = sys.argv[3].replace('/', '_')
        
        with open(html_file, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        extractor = StitchUIExtractor()
        components = extractor.extract_component_patterns(html_content)
        
        # Process components
        processed = []
        for comp in components:
            comp['type'] = extractor.classify_component_type(
                comp['tag'], comp['classes'], comp.get('dataAttrs', {})
            )
            comp['designSystem'] = extractor.detect_design_system(comp['classes'])
            comp['selector'] = f"{comp['tag']}{'#' + comp['id'] if comp['id'] else ''}"
            processed.append(comp)
        
        report = extractor.generate_design_system_report(processed)
        extractor.save_sdui_metadata(page_id, report)
        
    else:
        page_id = sys.argv[1]
        
        # Read from stdin if piped
        if not sys.stdin.isatty():
            html_content = sys.stdin.read()
        else:
            print("[Stitch] No HTML content provided. Use --html-file or pipe HTML content.")
            sys.exit(1)
        
        components = extractor.extract_component_patterns(html_content)
        
        processed = []
        for comp in components:
            comp['type'] = extractor.classify_component_type(
                comp['tag'], comp['classes'], comp.get('dataAttrs', {})
            )
            comp['designSystem'] = extractor.detect_design_system(comp['classes'])
            comp['selector'] = f"{comp['tag']}{'#' + comp['id'] if comp['id'] else ''}"
            processed.append(comp)
        
        report = extractor.generate_design_system_report(processed)
        extractor.save_sdui_metadata(page_id, report)
        
        print(f"[Stitch] Total components: {len(processed)}")
        print(f"[Stitch] Component types: {dict(report['summary']['componentTypes'])}")
        print(f"[Stitch] Design systems: {dict(report['summary']['designSystems'])}")

if __name__ == '__main__':
    main()
