'use client';

import type {
  VisualSpec,
  FractionBarVisual,
  ShapeVisual,
  AngleVisual,
  BarChartVisual,
  NumberLineVisual,
} from '@/packages/shared-types';

/**
 * One deterministic SVG renderer per supported visualSpec kind.
 * These render exactly the validated numbers/enums in the spec —
 * never LLM-authored markup or prose. The spec has already passed
 * VisualSpecSchema (structural well-formedness) and
 * validateQuestionConsistency (agreement with the rest of the
 * question) on the server before it ever reaches this component.
 */

function FractionBar({ spec }: { spec: FractionBarVisual }) {
  const width = 280;
  const height = 64;
  const partWidth = width / spec.totalParts;

  if (spec.layout === 'circle') {
    const radius = 60;
    const cx = 70;
    const cy = 70;
    const anglePerPart = 360 / spec.totalParts;

    const arcPath = (index: number) => {
      const startAngle = (index * anglePerPart - 90) * (Math.PI / 180);
      const endAngle = ((index + 1) * anglePerPart - 90) * (Math.PI / 180);
      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);
      const largeArc = anglePerPart > 180 ? 1 : 0;
      return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    };

    return (
      <svg width={140} height={140} viewBox="0 0 140 140" role="img" aria-label={`Circle divided into ${spec.totalParts} parts, ${spec.shadedParts} shaded`}>
        {Array.from({ length: spec.totalParts }).map((_, i) => (
          <path
            key={i}
            d={arcPath(i)}
            fill={i < spec.shadedParts ? '#6366f1' : '#ffffff'}
            stroke="#333"
            strokeWidth={1.5}
          />
        ))}
      </svg>
    );
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Bar divided into ${spec.totalParts} parts, ${spec.shadedParts} shaded`}>
      {Array.from({ length: spec.totalParts }).map((_, i) => (
        <rect
          key={i}
          x={i * partWidth}
          y={0}
          width={partWidth}
          height={height}
          fill={i < spec.shadedParts ? '#6366f1' : '#ffffff'}
          stroke="#333"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

const SHAPE_POINTS: Record<Exclude<ShapeVisual['shape'], 'circle'>, string> = {
  triangle: '60,10 110,100 10,100',
  square: '20,20 100,20 100,100 20,100',
  rectangle: '10,30 110,30 110,90 10,90',
  pentagon: '60,5 112,42 92,105 28,105 8,42',
  hexagon: '30,5 90,5 115,55 90,105 30,105 5,55',
};

function Shape({ spec }: { spec: ShapeVisual }) {
  return (
    <svg width={120} height={110} viewBox="0 0 120 110" role="img" aria-label={spec.shape}>
      {spec.shape === 'circle' ? (
        <circle cx={60} cy={55} r={50} fill="#e0e7ff" stroke="#333" strokeWidth={1.5} />
      ) : (
        <polygon points={SHAPE_POINTS[spec.shape]} fill="#e0e7ff" stroke="#333" strokeWidth={1.5} />
      )}
    </svg>
  );
}

function Angle({ spec }: { spec: AngleVisual }) {
  const cx = 20;
  const cy = 110;
  const radius = 90;
  const radians = (spec.degrees * Math.PI) / 180;
  const rayX = cx + radius * Math.cos(radians);
  const rayY = cy - radius * Math.sin(radians);
  const arcRadius = 30;
  const arcEndX = cx + arcRadius * Math.cos(radians);
  const arcEndY = cy - arcRadius * Math.sin(radians);
  const largeArc = spec.degrees > 180 ? 1 : 0;

  return (
    <svg width={220} height={130} viewBox="0 0 220 130" role="img" aria-label={`${spec.degrees} degree ${spec.angleType} angle`}>
      <line x1={cx} y1={cy} x2={cx + radius} y2={cy} stroke="#333" strokeWidth={2} />
      <line x1={cx} y1={cy} x2={rayX} y2={rayY} stroke="#333" strokeWidth={2} />
      <path
        d={`M ${cx + arcRadius} ${cy} A ${arcRadius} ${arcRadius} 0 ${largeArc} 0 ${arcEndX} ${arcEndY}`}
        fill="none"
        stroke="#6366f1"
        strokeWidth={2}
      />
    </svg>
  );
}

function BarChart({ spec }: { spec: BarChartVisual }) {
  const maxValue = Math.max(...spec.bars.map((bar) => bar.value), 1);
  const barWidth = 32;
  const gap = 16;
  const chartHeight = 100;
  const width = spec.bars.length * (barWidth + gap) + gap;

  return (
    <svg width={width} height={chartHeight + 30} viewBox={`0 0 ${width} ${chartHeight + 30}`} role="img" aria-label={spec.yAxisLabel ?? 'bar chart'}>
      {spec.bars.map((bar, i) => {
        const barHeight = (bar.value / maxValue) * chartHeight;
        const x = gap + i * (barWidth + gap);
        return (
          <g key={bar.label}>
            <rect x={x} y={chartHeight - barHeight} width={barWidth} height={barHeight} fill="#6366f1" />
            <text x={x + barWidth / 2} y={chartHeight + 16} fontSize={11} textAnchor="middle" fill="#333">
              {bar.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function NumberLine({ spec }: { spec: NumberLineVisual }) {
  const width = 300;
  const step = spec.step ?? 1;
  const scale = (value: number) => 10 + ((value - spec.min) / (spec.max - spec.min)) * (width - 20);

  const ticks: number[] = [];
  for (let v = spec.min; v <= spec.max + 1e-9; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }

  return (
    <svg width={width} height={56} viewBox={`0 0 ${width} 56`} role="img" aria-label={`Number line from ${spec.min} to ${spec.max}`}>
      <line x1={10} y1={28} x2={width - 10} y2={28} stroke="#333" strokeWidth={2} />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={scale(v)} y1={22} x2={scale(v)} y2={34} stroke="#333" strokeWidth={1.5} />
          <text x={scale(v)} y={48} fontSize={10} textAnchor="middle" fill="#333">{v}</text>
        </g>
      ))}
      {(spec.markers ?? []).map((m) => (
        <circle key={m} cx={scale(m)} cy={28} r={5} fill="#ef4444" />
      ))}
    </svg>
  );
}

export function QuestionVisual({ spec }: { spec?: VisualSpec }) {
  if (!spec) return null;

  return (
    <div className="flex justify-center py-2">
      {spec.type === 'fraction-bar' && <FractionBar spec={spec} />}
      {spec.type === 'shape' && <Shape spec={spec} />}
      {spec.type === 'angle' && <Angle spec={spec} />}
      {spec.type === 'bar-chart' && <BarChart spec={spec} />}
      {spec.type === 'number-line' && <NumberLine spec={spec} />}
    </div>
  );
}
