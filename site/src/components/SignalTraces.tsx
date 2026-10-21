import { useEffect, useRef, useState } from 'react';
import {
  LazyMotion,
  MotionConfig,
  domAnimation,
  m,
  useInView,
  useReducedMotion,
} from 'motion/react';

type Point = readonly [number, number];
type Trace = {
  points: Point[];
  via: Point;
  pulse?: { speed: number; rest: number; delay: number };
};

/** How far the field extends beyond the card; the hero clips whatever falls outside it. */
const PAD = 960;
/** Traces begin under the card, so pulses arrive out of sight. */
const INSET = 24;
/** Pulses start this far along a trace from the card edge. */
const PULSE_REACH = 560;

const distance = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/**
 * Board traces in card coordinates, ordered from the card outward. Each family keeps a fixed
 * lane order so no two traces cross: a bus up and down the gap beside the text, then traces
 * leaving the right, top, and bottom edges with 45° chamfers.
 */
function buildTraces(width: number, height: number): Trace[] {
  const traces: Trace[] = [];
  const chamfer = 10;
  [0.16, 0.24, 0.32].forEach((at, lane) => {
    const y = height * at;
    const x = -(22 + 13 * lane);
    traces.push({
      points: [
        [INSET, y],
        [x + chamfer, y],
        [x, y - chamfer],
        [x, -PAD],
      ],
      via: [x, y - chamfer],
      pulse: lane === 1 ? { speed: 120, rest: 2.4, delay: 0.6 } : undefined,
    });
  });
  [0.84, 0.76, 0.68].forEach((at, lane) => {
    const y = height * at;
    const x = -(22 + 13 * lane);
    traces.push({
      points: [
        [INSET, y],
        [x + chamfer, y],
        [x, y + chamfer],
        [x, height + PAD],
      ],
      via: [x, y + chamfer],
      pulse: lane === 2 ? { speed: 105, rest: 3.1, delay: 2.2 } : undefined,
    });
  });
  [0.22, 0.5, 0.8].forEach((at, lane) => {
    const y = height * at;
    const jog = lane === 1 ? -16 : 16;
    traces.push({
      points: [
        [width - INSET, y],
        [width + 40, y],
        [width + 56, y + jog],
        [width + PAD, y + jog],
      ],
      via: [width + 56, y + jog],
      pulse: lane !== 1 ? { speed: 140, rest: 1.8 + lane, delay: 1.2 + lane * 0.9 } : undefined,
    });
  });
  [0.55, 0.7, 0.85].forEach((at, lane) => {
    const x = width * at;
    const y = -(50 - 12 * lane);
    traces.push({
      points: [
        [x, INSET],
        [x, y + chamfer],
        [x + chamfer, y],
        [width + PAD, y],
      ],
      via: [x + chamfer, y],
      pulse: lane === 0 ? { speed: 150, rest: 2.6, delay: 3.4 } : undefined,
    });
  });
  [0.18, 0.36].forEach((at, lane) => {
    const x = width * at;
    const y = height + 50 - 12 * lane;
    traces.push({
      points: [
        [x, height - INSET],
        [x, y - chamfer],
        [x + chamfer, y],
        [width + PAD, y],
      ],
      via: [x + chamfer, y],
      pulse: lane === 0 ? { speed: 135, rest: 2.0, delay: 0.2 } : undefined,
    });
  });
  return traces;
}

/** The points from PULSE_REACH along the trace back to the card, with each one's share of the trip. */
function pulseRoute(points: Point[]) {
  const route: Point[] = [points[0]];
  let travelled = 0;
  for (let index = 1; index < points.length; index++) {
    const [from, to] = [points[index - 1], points[index]];
    const step = distance(from, to);
    if (travelled + step >= PULSE_REACH) {
      const share = (PULSE_REACH - travelled) / step;
      route.push([from[0] + (to[0] - from[0]) * share, from[1] + (to[1] - from[1]) * share]);
      travelled = PULSE_REACH;
      break;
    }
    route.push(to);
    travelled += step;
  }
  route.reverse();
  const offsets = [0];
  let covered = 0;
  for (let index = 1; index < route.length; index++) {
    covered += distance(route[index - 1], route[index]);
    offsets.push(covered / travelled);
  }
  return { route, offsets, length: travelled };
}

/** A pulse travelling toward the card. Only transform and opacity animate, on the compositor. */
function Pulse({ points, speed, rest, delay }: { points: Point[] } & NonNullable<Trace['pulse']>) {
  const { route, offsets, length } = pulseRoute(points);
  const travel = length / speed;
  const duration = travel + rest;
  const share = travel / duration;
  const frames = [...route, route[route.length - 1]].map(
    ([x, y]) => `translate(${x + PAD - 3}px, ${y + PAD - 3}px)`,
  );
  const repeat = { duration, ease: 'linear', repeat: Infinity, delay } as const;
  return (
    <m.span
      className="trace-pulse"
      initial={{ opacity: 0, transform: frames[0] }}
      animate={{ transform: frames, opacity: [0, 1, 1, 0, 0] }}
      transition={{
        transform: { ...repeat, times: [...offsets.map((offset) => offset * share), 1] },
        opacity: { ...repeat, times: [0, 0.08 * share, 0.86 * share, share, 1] },
      }}
    />
  );
}

/**
 * Decorative circuit traces around the hero demo card. Loaded lazily after first paint; pulses run
 * only while the hero is near the viewport and never when reduced motion is requested.
 */
export default function SignalTraces() {
  const field = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const near = useInView(field);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const board = field.current?.parentElement;
    if (!board) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSize((current) =>
        current?.width === width && current.height === height ? current : { width, height },
      );
    });
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  const traces = size ? buildTraces(size.width, size.height) : [];
  const box = size ? { width: size.width + PAD * 2, height: size.height + PAD * 2 } : undefined;

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className="signal-field" ref={field} aria-hidden="true">
          {box && (
            <svg
              className="signal-traces"
              viewBox={`${-PAD} ${-PAD} ${box.width} ${box.height}`}
              width={box.width}
              height={box.height}
            >
              {traces.map((trace, index) => (
                <m.path
                  key={index}
                  d={`M${trace.points.map(([x, y]) => `${x} ${y}`).join('L')}`}
                  initial={reduceMotion ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    duration: 1.2,
                    delay: 0.1 + index * 0.04,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              ))}
              {traces.map((trace, index) => (
                <circle key={index} cx={trace.via[0]} cy={trace.via[1]} r={2.5} />
              ))}
            </svg>
          )}
          {near &&
            !reduceMotion &&
            traces.map(
              (trace, index) =>
                trace.pulse && <Pulse key={index} points={trace.points} {...trace.pulse} />,
            )}
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
