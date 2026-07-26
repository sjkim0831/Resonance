#!/usr/bin/env python3
"""
Master Orchestrator for Screen Generation Pipeline
===================================================

8-Layer Architecture:
  L01: Design Extraction   - Extract contracts from DB
  L02: Parse & Normalize   - Parse and normalize contract data
  L03: Validation          - Validate contract integrity
  L04: Template Generation - Generate base React templates
  L05: Screen Composition  - Compose React components
  L06: Screen Generation   - Generate screen files
  L07: Export              - Export routes and catalog
  L08: Watch               - Monitor design changes

Error Recovery:
  - Checkpoint after each layer
  - Resume from last successful layer
  - Track validation errors and warnings
"""

import os
import sys
import json
import time
import traceback
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional

# Add builder to path
sys.path.insert(0, str(Path(__file__).parent))

from builder.common.base import RecoveryManager, LayerResult, LayerStatus
from builder.common.types import ScreenContract, GenerationContext

# Import all layers
from builder.L01_design.extractor import DesignExtractor
from builder.L02_parse.parser import ContractParser
from builder.L03_validate.validator import ContractValidator
from builder.L04_template.generator import TemplateGenerator
from builder.L05_compose.composer import ScreenComposer
from builder.L06_generate.generator import ScreenGenerator
from builder.L07_export.exporter import ScreenExporter
from builder.L08_watch.watcher import DesignWatcher

class MasterOrchestrator:
    """Master orchestrator for the 8-layer generation pipeline"""
    
    VERSION = "1.0.0"
    LAYER_NAMES = [
        "Design Extraction",
        "Parse & Normalize", 
        "Validation",
        "Template Generation",
        "Screen Composition",
        "Screen Generation",
        "Export",
        "Design Watcher"
    ]
    
    def __init__(self, output_dir: Path = None):
        self.output_dir = output_dir or Path("/tmp/builder_output")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.checkpoint_dir = self.output_dir / ".checkpoints"
        self.recovery = RecoveryManager(self.checkpoint_dir)
        
        self.context = GenerationContext()
        self.layer_results: Dict[int, LayerResult] = {}
        self.start_time: float = 0
        self.errors: List[Dict] = []
        self.warnings: List[str] = []
        
        # Initialize layers
        self.layers = [
            DesignExtractor(),
            ContractParser(),
            ContractValidator(strict=False),
            TemplateGenerator(output_dir=self.output_dir / "04_template"),
            ScreenComposer(),
            ScreenGenerator(output_dir=self.output_dir / "06_generate/screens"),
            ScreenExporter(output_dir=self.output_dir / "07_export"),
            DesignWatcher(watch_dir=self.output_dir),
        ]
    
    def run(self, force: bool = False, from_layer: int = 0) -> bool:
        """Run the full pipeline"""
        self.start_time = time.time()
        
        print("=" * 70)
        print(f"Master Orchestrator v{self.VERSION}")
        print(f"Output: {self.output_dir}")
        print("=" * 70)
        
        # Check if we can resume
        if not force and from_layer == 0:
            last_layer = self.recovery.get_last_successful_layer()
            if last_layer > 0:
                print(f"\nFound checkpoint at Layer {last_layer}: {self.LAYER_NAMES[last_layer-1]}")
                response = input("Resume from there? [Y/n]: ").strip().lower()
                if response != 'n':
                    from_layer = last_layer + 1
        
        # Run pipeline
        success = self._run_pipeline(from_layer)
        
        # Report
        self._report(success)
        
        return success
    
    def _run_pipeline(self, from_layer: int = 0) -> bool:
        """Run pipeline from specified layer"""
        
        for i in range(from_layer, len(self.layers)):
            layer = self.layers[i]
            layer_num = i + 1
            layer_name = self.LAYER_NAMES[i]
            
            print(f"\n{'─' * 70}")
            print(f"[L{layer_num:02d}] {layer_name}")
            print(f"{'─' * 70}")
            
            try:
                # Get input data for this layer
                input_data = self._get_layer_input(i)
                
                # Execute layer
                success, output, result = layer.execute(self.context, input_data)
                
                self.layer_results[i] = result
                
                if success:
                    # Update context
                    self._update_context(i, output)
                    
                    # Save checkpoint
                    self._save_checkpoint(i, output)
                    
                    print(f"  ✓ Success ({result.duration:.2f}s, {result.processed_count} processed)")
                    if result.warning:
                        print(f"  ⚠ {result.warning}")
                else:
                    print(f"  ✗ Failed: {result.error}")
                    self.errors.append({
                        'layer': layer_num,
                        'name': layer_name,
                        'error': result.error
                    })
                    
                    # Offer recovery options
                    if not self._handle_layer_error(i, result):
                        return False
                
            except Exception as e:
                error_msg = f"{type(e).__name__}: {str(e)}"
                print(f"  ✗ Exception: {error_msg}")
                traceback.print_exc()
                
                self.errors.append({
                    'layer': layer_num,
                    'name': layer_name,
                    'error': error_msg,
                    'trace': traceback.format_exc()
                })
                
                if not self._handle_layer_error(i, None):
                    return False
        
        return True
    
    def _get_layer_input(self, layer_idx: int) -> Any:
        """Get input data for a layer"""
        if layer_idx == 0:
            return None  # L01 extracts from DB
        
        if layer_idx == 1:
            return self.context.contracts  # L02 needs contracts
        
        if layer_idx == 2:
            return self.context.contracts  # L03 needs contracts
        
        if layer_idx == 3:
            return self.context.contracts  # L04 needs contracts
        
        if layer_idx == 4:
            return self.context.contracts  # L05 needs contracts
        
        if layer_idx == 5:
            return self.context.screens  # L06 needs composed screens
        
        if layer_idx == 7:
            return None  # L08 watches for changes
        
        return None
    
    def _update_context(self, layer_idx: int, output: Any):
        """Update context with layer output"""
        if layer_idx == 0 and isinstance(output, list):
            self.context.contracts = output
        
        elif layer_idx == 1 and isinstance(output, list):
            self.context.contracts = output
        
        elif layer_idx == 4 and isinstance(output, dict):
            self.context.screens = output
        
        elif layer_idx == 6 and isinstance(output, dict):
            self.context.artifacts = output
    
    def _save_checkpoint(self, layer_idx: int, output: Any):
        """Save checkpoint after successful layer"""
        data = {
            'layer': layer_idx + 1,
            'name': self.LAYER_NAMES[layer_idx],
            'timestamp': datetime.now().isoformat(),
            'output_type': type(output).__name__
        }
        
        if isinstance(output, list):
            data['count'] = len(output)
        elif isinstance(output, dict):
            data['keys'] = list(output.keys())[:10]
        
        self.recovery.save_checkpoint(layer_idx + 1, self.LAYER_NAMES[layer_idx], data)
    
    def _handle_layer_error(self, layer_idx: int, result: Optional[LayerResult]) -> bool:
        """Handle layer error with recovery options"""
        print("\n" + "=" * 70)
        print("ERROR RECOVERY OPTIONS")
        print("=" * 70)
        print("  [1] Skip this layer and continue")
        print("  [2] Retry this layer")
        print("  [3] Reset from this layer")
        print("  [Q] Quit")
        
        choice = input("\nSelect option [1-3, Q]: ").strip().upper()
        
        if choice == '1':
            print("  → Skipping layer...")
            return True  # Continue to next layer
        
        elif choice == '2':
            print("  → Retrying layer...")
            return False  # Will retry same layer
        
        elif choice == '3':
            layer_num = layer_idx + 1
            # Remove checkpoints from this layer onwards
            for i in range(layer_num, 9):
                checkpoint_file = self.checkpoint_dir / f"layer_{i:02d}.json"
                if checkpoint_file.exists():
                    checkpoint_file.unlink()
            print(f"  → Reset checkpoints from layer {layer_num}")
            return False  # Will restart from this layer
        
        else:
            print("  → Quitting...")
            return False
    
    def _report(self, success: bool):
        """Generate final report"""
        duration = time.time() - self.start_time
        
        print("\n" + "=" * 70)
        print("PIPELINE REPORT")
        print("=" * 70)
        
        print(f"\nStatus: {'✓ SUCCESS' if success else '✗ FAILED'}")
        print(f"Duration: {duration:.2f}s")
        
        print("\nLayer Results:")
        for i, result in self.layer_results.items():
            status_icon = "✓" if result.success else "✗"
            print(f"  [L{i+1:02d}] {self.LAYER_NAMES[i]}: {status_icon} ({result.duration:.2f}s)")
            print(f"        Processed: {result.processed_count}, Failed: {result.failed_count}")
        
        if self.errors:
            print(f"\nErrors ({len(self.errors)}):")
            for err in self.errors:
                print(f"  [L{err['layer']:02d}] {err['name']}: {err['error']}")
        
        # Generate summary JSON
        summary = {
            'version': self.VERSION,
            'timestamp': datetime.now().isoformat(),
            'duration': duration,
            'success': success,
            'layers': [
                {
                    'num': i + 1,
                    'name': self.LAYER_NAMES[i],
                    'success': r.success,
                    'duration': r.duration,
                    'processed': r.processed_count,
                    'failed': r.failed_count
                }
                for i, r in self.layer_results.items()
            ],
            'errors': self.errors,
            'warnings': self.warnings,
            'contracts_count': len(self.context.contracts),
            'screens_count': len(self.context.screens)
        }
        
        summary_file = self.output_dir / "pipeline_summary.json"
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2, default=str)
        
        print(f"\nSummary: {summary_file}")
        print("=" * 70)
    
    def status(self) -> Dict:
        """Get current pipeline status"""
        last_layer = self.recovery.get_last_successful_layer()
        history = self.recovery.load_history()
        
        return {
            'last_successful_layer': last_layer,
            'last_layer_name': self.LAYER_NAMES[last_layer - 1] if last_layer > 0 else None,
            'history': history,
            'checkpoints_exist': last_layer > 0
        }
    
    def reset(self, from_layer: int = 1):
        """Reset checkpoints from specified layer"""
        for i in range(from_layer, 9):
            checkpoint_file = self.checkpoint_dir / f"layer_{i:02d}.json"
            if checkpoint_file.exists():
                checkpoint_file.unlink()
                print(f"Removed checkpoint: layer_{i:02d}.json")
        
        history_file = self.checkpoint_dir / "history.json"
        if history_file.exists():
            history_file.unlink()
        
        print("Checkpoints reset complete")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Master Orchestrator for Screen Generation')
    parser.add_argument('--output', type=str, help='Output directory')
    parser.add_argument('--force', action='store_true', help='Force full run without asking')
    parser.add_argument('--from', dest='from_layer', type=int, default=0, help='Start from layer N')
    parser.add_argument('--reset', action='store_true', help='Reset checkpoints')
    parser.add_argument('--status', action='store_true', help='Show pipeline status')
    
    args = parser.parse_args()
    
    output_dir = Path(args.output) if args.output else Path("/tmp/builder_output")
    
    orchestrator = MasterOrchestrator(output_dir)
    
    if args.reset:
        orchestrator.reset()
        return
    
    if args.status:
        status = orchestrator.status()
        print(json.dumps(status, indent=2, default=str))
        return
    
    success = orchestrator.run(force=args.force, from_layer=args.from_layer)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
