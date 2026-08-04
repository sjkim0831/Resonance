"""Type definitions for the builder system"""

from typing import Dict, List, Any, Optional, Literal, TypedDict
from dataclasses import dataclass, field

# Field types supported
FIELD_TYPES = [
    'TEXT', 'NUMBER', 'DATE', 'DATETIME', 'SELECT', 'CHECKBOX', 'SWITCH',
    'RADIO', 'AUTOCOMPLETE', 'SLIDER', 'FILE', 'IMAGE', 'EMAIL', 'PASSWORD',
    'PHONE', 'TEXTAREA', 'CODE', 'ENUM', 'HIDDEN', 'CALCULATED', 'ADDRESS'
]

# HTTP methods
HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

@dataclass
class ApiContract:
    method: str
    path: str
    code: str = ""
    description: str = ""
    
    def validate(self) -> bool:
        return self.method.upper() in HTTP_METHODS and self.path.startswith('/')

@dataclass
class FieldContract:
    field_code: str
    field_name: str
    data_type: str = "TEXT"
    required: bool = False
    options: List[Dict[str, Any]] = field(default_factory=list)
    option_source: Dict[str, Any] = field(default_factory=dict)
    validation: Dict[str, Any] = field(default_factory=dict)
    default_value: Any = None
    placeholder: str = ""
    help_text: str = ""
    read_only: bool = False
    visible: bool = True
    section_code: str = "default"

@dataclass  
class SectionContract:
    section_code: str
    section_name: str
    order: int = 1
    layout: str = "vertical"  # vertical, horizontal, grid
    collapsible: bool = False

@dataclass
class ScreenContract:
    contract_id: int
    route_path: str
    screen_name: str
    process_code: str = "UNKNOWN"
    actor_code: str = "USER"
    step_code: str = ""
    audience: str = ""
    business_purpose: str = ""
    entry_condition: str = ""
    exit_condition: str = ""
    command_contract: Any = field(default_factory=list)
    data_contract: Any = field(default_factory=dict)
    evidence_contract: Any = field(default_factory=dict)
    responsive_contract: Any = field(default_factory=dict)
    accessibility_contract: Any = field(default_factory=dict)
    security_contract: Any = field(default_factory=dict)
    input_schema: Any = field(default_factory=dict)
    output_schema: Any = field(default_factory=dict)
    persistence_schema: Any = field(default_factory=dict)
    handoff_schema: Any = field(default_factory=dict)
    context_keys: List[str] = field(default_factory=list)
    permissions: List[Dict[str, Any]] = field(default_factory=list)
    tests: List[Dict[str, Any]] = field(default_factory=list)
    api_contract: List[ApiContract] = field(default_factory=list)
    state_contract: List[str] = field(default_factory=list)
    field_contract: List[FieldContract] = field(default_factory=list)
    section_contract: List[SectionContract] = field(default_factory=list)
    
    def get_field_count(self) -> int:
        return len(self.field_contract)
    
    def get_section_count(self) -> int:
        return len(self.section_contract)
    
    def get_api_count(self) -> int:
        return len(self.api_contract)

    def to_five_layer_contract(self) -> Dict[str, Any]:
        """Project the legacy contract into the renderer-neutral v1 contract.

        The legacy columns remain the source of truth.  This projection keeps
        React, mobile, PDF and desktop renderers from inventing independent
        interpretations of fields, actions, process state and authority.
        """
        fields = [
            {
                "code": item.field_code,
                "name": item.field_name,
                "type": item.data_type,
                "required": item.required,
                "section": item.section_code,
                "options": item.options,
                "optionSource": item.option_source,
                "validation": item.validation,
                "defaultValue": item.default_value,
                "placeholder": item.placeholder,
                "helpText": item.help_text,
                "readOnly": item.read_only,
                "visible": item.visible,
            }
            for item in self.field_contract
        ]
        sections = [
            {
                "code": item.section_code,
                "name": item.section_name,
                "order": item.order,
                "layout": item.layout,
                "collapsible": item.collapsible,
            }
            for item in self.section_contract
        ]
        apis = [
            {
                "code": item.code,
                "method": item.method,
                "path": item.path,
                "description": item.description,
            }
            for item in self.api_contract
        ]
        return {
            "version": "1.0",
            "screen": {
                "contractId": self.contract_id,
                "route": self.route_path,
                "name": self.screen_name,
                "audience": self.audience,
                "purpose": self.business_purpose,
            },
            "dataSchema": {
                "fields": fields,
                "input": self.input_schema,
                "output": self.output_schema,
                "persistence": self.persistence_schema,
                "handoff": self.handoff_schema,
                "contextKeys": self.context_keys,
                "contract": self.data_contract,
            },
            "uiSchema": {
                "sections": sections,
                "responsive": self.responsive_contract,
                "accessibility": self.accessibility_contract,
            },
            "actionSchema": {
                "commands": self.command_contract,
                "apis": apis,
                "evidence": self.evidence_contract,
            },
            "processSchema": {
                "processCode": self.process_code,
                "stepCode": self.step_code,
                "states": self.state_contract,
                "entryCondition": self.entry_condition,
                "exitCondition": self.exit_condition,
                "tests": self.tests,
            },
            "permissionSchema": {
                "actorCode": self.actor_code,
                "rules": self.permissions,
                "security": self.security_contract,
            },
        }

@dataclass
class GenerationContext:
    contracts: List[ScreenContract] = field(default_factory=list)
    templates: Dict[str, str] = field(default_factory=dict)
    screens: Dict[int, str] = field(default_factory=dict)  # contract_id -> component_code
    routes: List[Dict[str, str]] = field(default_factory=list)
    validation_errors: List[Dict] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    def add_error(self, contract_id: int, error_type: str, message: str):
        self.validation_errors.append({
            'contract_id': contract_id,
            'type': error_type,
            'message': message
        })
    
    def add_warning(self, contract_id: int, warning: str):
        self.warnings.append(f"#{contract_id}: {warning}")
