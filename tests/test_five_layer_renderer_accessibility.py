import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RENDERER = ROOT / (
    "projects/carbonet-frontend/source/src/features/contract-runtime/"
    "FiveLayerFormRenderer.tsx"
)


class FiveLayerRendererAccessibilityTest(unittest.TestCase):
    def test_generated_multi_checkbox_controls_have_accessible_names(self):
        source = RENDERER.read_text(encoding="utf-8")
        self.assertIn('field.type === "MULTI_CHECKBOX"', source)
        self.assertIn('<input aria-label={optionLabel}', source)


if __name__ == "__main__":
    unittest.main()
