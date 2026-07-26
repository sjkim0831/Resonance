"""Base classes for layered architecture"""

import json
import time
import traceback
import hashlib
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from enum import Enum
from abc import ABC, abstractmethod

class LayerStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    RECOVERED = "recovered"

@dataclass
class LayerResult:
    success: bool
    duration: float
    files_created: int = 0
    processed_count: int = 0
    failed_count: int = 0
    error: str = ""
    warning: str = ""
    artifacts: Dict[str, Any] = field(default_factory=dict)
    checkpoint_data: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Checkpoint:
    layer_num: int
    layer_name: str
    timestamp: str
    data: Dict[str, Any]
    checksum: str
    
    def save(self, path: Path):
        with open(path, 'w') as f:
            json.dump({
                'layer_num': self.layer_num,
                'layer_name': self.layer_name,
                'timestamp': self.timestamp,
                'data': self.data,
                'checksum': self.checksum
            }, f, indent=2, default=str)
    
    @classmethod
    def load(cls, path: Path) -> Optional['Checkpoint']:
        if path.exists():
            with open(path, 'r') as f:
                return cls(**json.load(f))
        return None

class RecoveryManager:
    """Manages checkpoint-based recovery"""
    
    def __init__(self, checkpoint_dir: Path):
        self.checkpoint_dir = checkpoint_dir
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.history: List[Dict] = []
    
    def save_checkpoint(self, layer_num: int, layer_name: str, data: Dict) -> Checkpoint:
        """Save checkpoint for a layer"""
        checksum = hashlib.md5(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()[:12]
        checkpoint = Checkpoint(
            layer_num=layer_num,
            layer_name=layer_name,
            timestamp=datetime.now().isoformat(),
            data=data,
            checksum=checksum
        )
        checkpoint.save(self.checkpoint_dir / f"layer_{layer_num:02d}.json")
        
        self.history.append({
            'layer': layer_num,
            'name': layer_name,
            'timestamp': checkpoint.timestamp,
            'checksum': checksum
        })
        
        self._save_history()
        return checkpoint
    
    def load_checkpoint(self, layer_num: int) -> Optional[Checkpoint]:
        """Load checkpoint for a layer"""
        path = self.checkpoint_dir / f"layer_{layer_num:02d}.json"
        return Checkpoint.load(path)
    
    def get_last_successful_layer(self) -> int:
        """Find the last successfully completed layer"""
        for i in range(8, 0, -1):
            if (self.checkpoint_dir / f"layer_{i:02d}.json").exists():
                cp = self.load_checkpoint(i)
                if cp:
                    return i
        return 0
    
    def _save_history(self):
        with open(self.checkpoint_dir / "history.json", 'w') as f:
            json.dump(self.history, f, indent=2, default=str)
    
    def load_history(self) -> List[Dict]:
        path = self.checkpoint_dir / "history.json"
        if path.exists():
            with open(path, 'r') as f:
                self.history = json.load(f)
        return self.history

class LayerBase(ABC):
    """Base class for all layers"""
    
    def __init__(self, layer_num: int, name: str, description: str):
        self.layer_num = layer_num
        self.name = name
        self.description = description
        self.status = LayerStatus.PENDING
        self.errors: List[Dict] = []
        self.warnings: List[str] = []
        self.start_time: float = 0
        self.checkpoint_data: Dict[str, Any] = {}
    
    def log(self, msg: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        layer_num = self.layer_num
        print(f"[{timestamp}] L{layer_num:02d} {level}: {msg}")
    
    def log_error(self, item_id: Any, error: str, details: Dict = None):
        self.errors.append({
            'item_id': str(item_id),
            'error': error,
            'details': details or {}
        })
        self.log(f"ERROR {item_id}: {error}", "ERROR")
    
    def log_warning(self, item_id: Any, warning: str):
        self.warnings.append(f"{item_id}: {warning}")
        self.log(f"WARNING {item_id}: {warning}", "WARN")
    
    def create_result(self, success: bool, duration: float, **kwargs) -> LayerResult:
        return LayerResult(
            success=success,
            duration=duration,
            files_created=kwargs.get('files_created', 0),
            processed_count=kwargs.get('processed_count', 0),
            failed_count=kwargs.get('failed_count', 0),
            error=kwargs.get('error', ''),
            warning=kwargs.get('warning', ''),
            artifacts=kwargs.get('artifacts', {}),
            checkpoint_data=self.checkpoint_data
        )
    
    @abstractmethod
    def execute(self, context: Dict, input_data: Any) -> tuple[bool, Any, LayerResult]:
        """
        Execute the layer
        Returns: (success, output_data, result)
        """
        pass
    
    def run_safe(self, context: Dict, input_data: Any, recovery: RecoveryManager) -> tuple[bool, Any, LayerResult]:
        """Execute with error handling and recovery"""
        self.start_time = time.time()
        self.status = LayerStatus.RUNNING
        self.log(f"Starting {self.name}")
        
        # Check for existing checkpoint
        checkpoint = recovery.load_checkpoint(self.layer_num)
        if checkpoint:
            self.log(f"Found checkpoint from {checkpoint.timestamp}")
            input_data = checkpoint.data.get('input', input_data)
        
        try:
            success, output, result = self.execute(context, input_data)
            
            if success:
                self.status = LayerStatus.SUCCESS
                self.checkpoint_data = {
                    'input': str(type(input_data)),
                    'output': str(type(output)),
                    'processed': result.processed_count,
                    'failed': result.failed_count
                }
                recovery.save_checkpoint(self.layer_num, self.name, self.checkpoint_data)
                self.log(f"Completed {self.name} in {result.duration:.2f}s")
            else:
                self.status = LayerStatus.FAILED
                self.log(f"Failed {self.name}: {result.error}", "ERROR")
            
            return success, output, result
            
        except Exception as e:
            self.status = LayerStatus.FAILED
            error_msg = f"{type(e).__name__}: {str(e)}"
            self.log(f"Exception in {self.name}: {error_msg}", "ERROR")
            traceback.print_exc()
            
            result = self.create_result(False, time.time() - self.start_time, error=error_msg)
            return False, None, result
