"""
Layer Architecture for Mass Screen Generation
==============================================
Layer 01: Contract - Extract & parse contracts from DB
Layer 02: Validation - Validate contract integrity
Layer 03: Templates - Generate base component templates
Layer 04: Composer - Compose screens from contracts + templates
Layer 05: Exporter - Export and register screens

Runtime Support:
- hooks/ - React hooks for generated screens
- utils/ - Utility functions
- types/ - TypeScript type definitions
- registry/ - Screen registry
"""

from .layer_base import LayerBase, LayerResult

__all__ = ['LayerBase', 'LayerResult']
