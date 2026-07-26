"""Base classes for layered architecture"""

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Callable
from abc import ABC, abstractmethod
import time
import traceback

@dataclass
class LayerResult:
    success: bool
    duration: float
    files_created: int = 0
    error: str = ""
    warning: str = ""
    artifacts: Dict[str, Any] = field(default_factory=dict)
    processed_count: int = 0
    failed_count: int = 0

class LayerBase(ABC):
    """Base class for all layers"""
    
    def __init__(self, name: str, layer_num: int):
        self.name = name
        self.layer_num = layer_num
        self.errors: List[Dict] = []
        self.warnings: List[str] = []
        
    @abstractmethod
    def execute(self, context: Dict, options: Dict = None) -> LayerResult:
        """Execute layer processing"""
        pass
    
    def _track_error(self, item_id: Any, error: str, details: Dict = None):
        """Track error for reporting"""
        self.errors.append({
            'layer': self.layer_num,
            'item_id': str(item_id),
            'error': error,
            'details': details or {}
        })
    
    def _track_warning(self, item_id: Any, warning: str):
        """Track warning"""
        self.warnings.append(f"{item_id}: {warning}")
    
    def _create_result(self, success: bool, duration: float, 
                       files: int = 0, processed: int = 0, failed: int = 0,
                       error: str = "", warning: str = "") -> LayerResult:
        return LayerResult(
            success=success,
            duration=duration,
            files_created=files,
            processed_count=processed,
            failed_count=failed,
            error=error,
            warning=warning,
            artifacts={'errors': self.errors, 'warnings': self.warnings}
        )
