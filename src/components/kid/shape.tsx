import { cn } from "@/lib/utils";

export type ShapeKind = "circle" | "star" | "square" | "triangle" | "heart";

export const SHAPE_KINDS: ShapeKind[] = ["circle", "star", "square", "triangle", "heart"];

/** The Go/No-Go "don't tap" stimulus colour. */
export const NOGO_FILL = "oklch(0.64 0.21 27)";

const FILL: Record<ShapeKind, string> = {
  circle: "var(--kid-sky)",
  star: "var(--kid-butter)",
  square: "var(--kid-mint)",
  triangle: "var(--kid-peach)",
  heart: "var(--kid-rose)",
};

const PATHS: Record<ShapeKind, React.ReactNode> = {
  circle: <circle cx="50" cy="50" r="40" />,
  square: <rect x="14" y="14" width="72" height="72" rx="14" />,
  triangle: <path d="M50 12 L90 84 Q92 88 87 88 L13 88 Q8 88 10 84 Z" strokeLinejoin="round" />,
  star: (
    <path
      d="M50 8 L61.8 35.6 L91.6 38.2 L69 57.8 L75.8 87 L50 71.6 L24.2 87 L31 57.8 L8.4 38.2 L38.2 35.6 Z"
      strokeLinejoin="round"
    />
  ),
  heart: (
    <path d="M50 86 C20 66 8 50 8 33 C8 20 18 11 30 11 C39 11 46 16 50 24 C54 16 61 11 70 11 C82 11 92 20 92 33 C92 50 80 66 50 86 Z" />
  ),
};

export function Shape({
  kind,
  className,
  title,
  fill,
}: {
  kind: ShapeKind;
  className?: string;
  title?: string;
  /** Override the default pastel fill (e.g. the Go/No-Go red star). */
  fill?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("size-24", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <g fill={fill ?? FILL[kind]} stroke="var(--kid-ink)" strokeWidth="4">
        {PATHS[kind]}
      </g>
    </svg>
  );
}
