import { useId } from "react";

/**
 * MemCoach 品牌图形：
 * 将 M 形增长路径与记忆节点图谱融合，强调“持续记忆 + 定向成长”。
 */
export default function BrandMark({
  className = "w-6 h-6",
  title,
  showBackground = false,
}) {
  const uid = useId().replace(/:/g, "");
  const hasTitle = typeof title === "string" && title.length > 0;
  const titleId = `${uid}-title`;
  const backgroundId = `${uid}-background`;
  const glowId = `${uid}-glow`;
  const strokeId = `${uid}-stroke`;
  const nodeId = `${uid}-node`;
  const shadowId = `${uid}-shadow`;
  const arrowId = `${uid}-arrow`;

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      role={hasTitle ? "img" : undefined}
      aria-hidden={hasTitle ? undefined : true}
      aria-labelledby={hasTitle ? titleId : undefined}
    >
      {hasTitle ? <title id={titleId}>{title}</title> : null}

      <defs>
        <linearGradient id={backgroundId} x1="10" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0B1E24" />
          <stop offset="1" stopColor="#041116" />
        </linearGradient>
        <radialGradient id={glowId} cx="0" cy="0" r="1" gradientTransform="translate(28 16) rotate(48) scale(32 40)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" stopOpacity="0.24" />
          <stop offset="1" stopColor="#10B981" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={strokeId} x1="14" y1="46" x2="50" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="0.55" stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#D9F99D" />
        </linearGradient>
        <linearGradient id={nodeId} x1="16" y1="44" x2="46" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A7F3D0" />
          <stop offset="0.55" stopColor="#67E8F9" />
          <stop offset="1" stopColor="#D9F99D" />
        </linearGradient>
        <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.4" floodColor="#10B981" floodOpacity="0.22" />
        </filter>
        <marker id={arrowId} viewBox="0 0 12 12" refX="9.6" refY="6" markerWidth="4.6" markerHeight="4.6" orient="auto">
          <path
            d="M1 1L11 6L1 11"
            fill="none"
            stroke="#D9F99D"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>

      {showBackground ? (
        <g>
          <rect x="4" y="4" width="56" height="56" rx="18" fill={`url(#${backgroundId})`} />
          <rect x="4.75" y="4.75" width="54.5" height="54.5" rx="17.25" stroke="#2DD4BF" strokeOpacity="0.18" strokeWidth="1.5" />
          <circle cx="24" cy="18" r="22" fill={`url(#${glowId})`} />
        </g>
      ) : null}

      <g filter={`url(#${shadowId})`}>
        <path
          d="M14 46L33 35L48 16"
          stroke="#2DD4BF"
          strokeOpacity="0.34"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24 23L33 35L44 28"
          stroke="#67E8F9"
          strokeOpacity="0.32"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 46L24 23L33 35L48 16"
          stroke={`url(#${strokeId})`}
          strokeWidth="5.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={`url(#${arrowId})`}
        />
        <circle cx="14" cy="46" r="3.6" fill={`url(#${nodeId})`} stroke="#06161A" strokeWidth="1.5" />
        <circle cx="24" cy="23" r="3.6" fill={`url(#${nodeId})`} stroke="#06161A" strokeWidth="1.5" />
        <circle cx="33" cy="35" r="4" fill={`url(#${nodeId})`} stroke="#06161A" strokeWidth="1.5" />
        <circle cx="44" cy="28" r="3.2" fill={`url(#${nodeId})`} stroke="#06161A" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
