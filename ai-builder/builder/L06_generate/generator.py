"""Generate individual screen files"""

import hashlib
import json
from pathlib import Path
from typing import Dict, List, Any, Tuple

from builder.common.types import ScreenContract
from builder.common.base import LayerBase, LayerResult

class ScreenGenerator(LayerBase):
    """Layer 06: Generate screen files to disk"""
    
    def __init__(self, output_dir: Path = None):
        super().__init__(6, "Screen Generator", "Generate screen files to disk")
        self.output_dir = output_dir or Path("/tmp/builder_output/06_generate/screens")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Track checksums for change detection
        self.file_checksums: Dict[str, str] = {}
    
    def execute(self, context: Dict, input_data: Dict[int, str]) -> Tuple[bool, Dict[str, str], LayerResult]:
        """Generate screen files"""
        self.log("Starting screen file generation")
        
        generated = {}
        errors = []
        
        # Load existing checksums
        self._load_checksums()
        
        for contract_id, component_code in input_data.items():
            try:
                screen_key = f"Screen{contract_id}"
                output_path = self.output_dir / f"{screen_key}.tsx"
                
                # Check if file changed
                if self._needs_update(output_path, component_code):
                    self._write_screen(output_path, component_code)
                    self.log(f"Generated: {screen_key}")
                else:
                    self.log(f"Skipped (unchanged): {screen_key}")
                
                generated[screen_key] = str(output_path)
                
            except Exception as e:
                errors.append({'contract_id': contract_id, 'error': str(e)})
                self.log_error(contract_id, str(e))
        
        # Save checksums
        self._save_checksums()
        
        # Generate index file
        self._generate_index(generated)
        
        result = self.create_result(
            len(errors) == 0, 0.1,
            files_created=len(generated),
            processed_count=len(input_data),
            failed_count=len(errors),
            artifacts={'output_dir': str(self.output_dir)}
        )
        
        self.log(f"Generated {len(generated)} screen files")
        return len(errors) == 0, generated, result
    
    def _needs_update(self, path: Path, content: str) -> bool:
        """Check if file needs update based on content hash"""
        if not path.exists():
            return True
        
        content_hash = self._hash_content(content)
        return self.file_checksums.get(str(path)) != content_hash
    
    def _hash_content(self, content: str) -> str:
        """Generate MD5 hash of content"""
        return hashlib.md5(content.encode('utf-8')).hexdigest()[:12]
    
    def _write_screen(self, path: Path, content: str):
        """Write screen file"""
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        self.file_checksums[str(path)] = self._hash_content(content)
    
    def _load_checksums(self):
        """Load existing checksums"""
        checksum_file = self.output_dir / ".checksums.json"
        if checksum_file.exists():
            with open(checksum_file, 'r') as f:
                self.file_checksums = json.load(f)
    
    def _save_checksums(self):
        """Save checksums for change detection"""
        checksum_file = self.output_dir / ".checksums.json"
        with open(checksum_file, 'w') as f:
            json.dump(self.file_checksums, f, indent=2)
    
    def _generate_index(self, screens: Dict[str, str]):
        """Generate index.tsx that exports all screens"""
        index_content = "// Auto-generated index - All screens\n\n"
        
        for screen_key, path in sorted(screens.items()):
            index_content += f"export {{ default as {screen_key} }} from './{screen_key}';\n"
        
        index_path = self.output_dir / "index.tsx"
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(index_content)
