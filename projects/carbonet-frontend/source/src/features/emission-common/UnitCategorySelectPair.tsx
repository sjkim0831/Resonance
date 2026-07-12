import { AdminSelect } from "../member/common";
import {
  getUnitOptionsByCategory,
  normalizeUnitValue,
  resolveUnitCategory,
  UNIT_CATEGORY_OPTIONS
} from "./unitOptions";

type UnitCategorySelectPairProps = {
  category?: string;
  unit?: string;
  disabled?: boolean;
  className?: string;
  onCategoryChange: (category: string) => void;
  onUnitChange: (unit: string) => void;
};

export function UnitCategorySelectPair({
  category = "",
  unit = "",
  disabled = false,
  className = "",
  onCategoryChange,
  onUnitChange
}: UnitCategorySelectPairProps) {
  const normalizedUnit = normalizeUnitValue(unit);
  const selectedCategory = category || resolveUnitCategory(normalizedUnit);

  return (
    <div
      className={`grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] gap-2 ${className}`}
      data-builder-component="UNIT_CATEGORY_SELECT_PAIR"
    >
      <label className="min-w-0">
        <span className="sr-only">단위 분류</span>
        <AdminSelect
          aria-label="단위 분류"
          disabled={disabled}
          onChange={(event) => onCategoryChange(event.target.value)}
          value={selectedCategory}
        >
          <option value="">분류 선택</option>
          {UNIT_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </AdminSelect>
      </label>
      <label className="min-w-0">
        <span className="sr-only">단위</span>
        <AdminSelect
          aria-label="단위"
          disabled={disabled}
          onChange={(event) => onUnitChange(event.target.value)}
          value={normalizedUnit}
        >
          <option value="">단위 선택</option>
          {getUnitOptionsByCategory(selectedCategory).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </AdminSelect>
      </label>
    </div>
  );
}
