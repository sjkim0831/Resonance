"""Watch for design changes and trigger regeneration"""

import json
import time
import hashlib
from pathlib import Path
from typing import Dict, Any, Callable, Optional
from datetime import datetime
from enum import Enum

from builder.common.base import LayerBase, LayerResult

class ChangeType(Enum):
    CREATED = "created"
    MODIFIED = "modified"
    DELETED = "deleted"
    UNCHANGED = "unchanged"

class DesignWatcher(LayerBase):
    """Layer 08: Watch for design changes"""
    
    def __init__(self, watch_dir: Path = None, callback: Callable = None):
        super().__init__(8, "Design Watcher", "Monitor design changes")
        self.watch_dir = watch_dir or Path("/tmp/builder_output")
        self.callback = callback
        self.last_state: Dict[str, str] = {}
        self.change_history: list = []
    
    def execute(self, context: Dict, input_data: Any) -> tuple[bool, Dict[str, Any], LayerResult]:
        """Check for changes and return diff"""
        self.log("Checking for design changes")
        
        current_state = self._scan_current_state()
        
        changes = self._diff_states(self.last_state, current_state)
        
        self.last_state = current_state
        
        # Save current state
        state_file = self.watch_dir / ".watch_state.json"
        with open(state_file, 'w') as f:
            json.dump(current_state, f, indent=2)
        
        result = self.create_result(
            True, 0.1,
            processed_count=len(current_state),
            artifacts={
                'changes': len(changes),
                'change_list': changes[:10] if len(changes) > 10 else changes
            }
        )
        
        self.log(f"Found {len(changes)} changes")
        
        return True, {'changes': changes}, result
    
    def _scan_current_state(self) -> Dict[str, str]:
        """Scan current state of design files"""
        state = {}
        
        # Scan design output directories
        for subdir in ['01_design', '02_parse', '03_validate']:
            path = self.watch_dir / subdir
            if path.exists():
                for file in path.rglob('*.json'):
                    try:
                        with open(file, 'r') as f:
                            content = f.read()
                            state[str(file)] = self._hash(content)
                    except:
                        pass
        
        return state
    
    def _hash(self, content: str) -> str:
        """Generate hash of content"""
        return hashlib.md5(content.encode('utf-8')).hexdigest()[:12]
    
    def _diff_states(self, old: Dict, new: Dict) -> list:
        """Diff two states and return changes"""
        changes = []
        
        # Find added/modified
        for path, new_hash in new.items():
            old_hash = old.get(path)
            if old_hash is None:
                changes.append({
                    'type': ChangeType.CREATED.value,
                    'path': path
                })
            elif old_hash != new_hash:
                changes.append({
                    'type': ChangeType.MODIFIED.value,
                    'path': path
                })
        
        # Find deleted
        for path, old_hash in old.items():
            if path not in new:
                changes.append({
                    'type': ChangeType.DELETED.value,
                    'path': path
                })
        
        # Record to history
        if changes:
            self.change_history.append({
                'timestamp': datetime.now().isoformat(),
                'changes': changes
            })
            
            history_file = self.watch_dir / ".change_history.jsonl"
            with open(history_file, 'a') as f:
                f.write(json.dumps(self.change_history[-1], ensure_ascii=False) + '\n')
        
        return changes
    
    def should_regenerate(self, changes: list) -> bool:
        """Determine if regeneration is needed"""
        # Regenerate if design-related layers changed
        design_layers = ['01_design', '02_parse', '03_validate']
        for change in changes:
            path = change.get('path', '')
            for layer in design_layers:
                if layer in path:
                    return True
        return False
