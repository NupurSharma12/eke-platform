/**
 * A structured, deterministic-to-render description of the diagram
 * a question needs — never a free-form image or LLM-authored
 * markup. The LLM emits only these typed, math-meaningful
 * parameters; a matching Zod schema (packages/ai/schemas) validates
 * them before anything is trusted, and a fixed set of React/SVG
 * components (components/visuals) render them deterministically
 * from the validated parameters, never from prose.
 *
 * A closed union by design: adding a new kind later means adding
 * one member here, one Zod branch, and one renderer — nothing else
 * changes.
 */
export type VisualSpec =
  | FractionBarVisual
  | ShapeVisual
  | AngleVisual
  | BarChartVisual
  | NumberLineVisual;

/** A bar divided into totalParts equal parts, shadedParts of them filled in. shadedParts <= totalParts (proper fractions only in v1). */
export interface FractionBarVisual {
  type: "fraction-bar";
  totalParts: number;
  shadedParts: number;
  layout?: "horizontal" | "circle";
}

export interface ShapeVisual {
  type: "shape";
  shape: "triangle" | "square" | "rectangle" | "circle" | "pentagon" | "hexagon";
  labels?: {
    sides?: number[];
    vertices?: string[];
  };
}

export type AngleType = "acute" | "right" | "obtuse" | "straight" | "reflex";

/** angleType must be the correct classification of degrees — enforced by VisualSpecSchema, not restated by callers. */
export interface AngleVisual {
  type: "angle";
  angleType: AngleType;
  degrees: number;
}

export interface BarChartVisual {
  type: "bar-chart";
  bars: { label: string; value: number }[];
  yAxisLabel?: string;
}

export interface NumberLineVisual {
  type: "number-line";
  min: number;
  max: number;
  step?: number;
  markers?: number[];
}
