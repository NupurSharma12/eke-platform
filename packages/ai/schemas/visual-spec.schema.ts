import { z } from "zod";
import { AngleType } from "../../shared-types";

const FractionBarVisualSchema = z.object({
  type: z.literal("fraction-bar"),
  totalParts: z.number().int().min(1),
  shadedParts: z.number().int().min(0),
  layout: z.enum(["horizontal", "circle"]).optional(),
});

const ShapeVisualSchema = z.object({
  type: z.literal("shape"),
  shape: z.enum(["triangle", "square", "rectangle", "circle", "pentagon", "hexagon"]),
  labels: z
    .object({
      sides: z.array(z.number()).optional(),
      vertices: z.array(z.string()).optional(),
    })
    .optional(),
});

const AngleVisualSchema = z.object({
  type: z.literal("angle"),
  angleType: z.enum(["acute", "right", "obtuse", "straight", "reflex"]),
  degrees: z.number().gt(0).lte(360),
});

const BarChartVisualSchema = z.object({
  type: z.literal("bar-chart"),
  bars: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.number().min(0),
      })
    )
    .min(2)
    .max(8),
  yAxisLabel: z.string().optional(),
});

const NumberLineVisualSchema = z.object({
  type: z.literal("number-line"),
  min: z.number(),
  max: z.number(),
  step: z.number().positive().optional(),
  markers: z.array(z.number()).optional(),
});

/**
 * The correct classification of a given degree value — the single
 * source of truth AngleVisualSchema checks angleType against, so
 * an internally-inconsistent spec (e.g. angleType "acute" with
 * degrees 120) fails validation rather than reaching a renderer.
 */
export function classifyAngleDegrees(degrees: number): AngleType | null {
  if (degrees <= 0 || degrees > 360) return null;
  if (degrees < 90) return "acute";
  if (degrees === 90) return "right";
  if (degrees < 180) return "obtuse";
  if (degrees === 180) return "straight";
  return "reflex";
}

/**
 * Structural validation only: is this spec internally well-formed
 * (shadedParts within totalParts, angleType matches degrees, min <
 * max, markers within range)? Whether the spec's *value* agrees
 * with the rest of the question (correctAnswer, questionText) is a
 * separate, deliberately non-Zod concern — see
 * validateQuestionConsistency in knowledge-engine/questionGeneration,
 * which knows about the surrounding draft this schema doesn't.
 */
export const VisualSpecSchema = z
  .discriminatedUnion("type", [
    FractionBarVisualSchema,
    ShapeVisualSchema,
    AngleVisualSchema,
    BarChartVisualSchema,
    NumberLineVisualSchema,
  ])
  .superRefine((spec, ctx) => {
    if (spec.type === "fraction-bar" && spec.shadedParts > spec.totalParts) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "shadedParts cannot exceed totalParts",
      });
    }

    if (spec.type === "angle") {
      const expected = classifyAngleDegrees(spec.degrees);
      if (expected !== spec.angleType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `angleType "${spec.angleType}" does not match degrees ${spec.degrees} (expected "${expected}")`,
        });
      }
    }

    if (spec.type === "number-line") {
      if (spec.min >= spec.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "min must be less than max",
        });
      }
      if (spec.markers?.some((m) => m < spec.min || m > spec.max)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "markers must fall within [min, max]",
        });
      }
    }
  });
