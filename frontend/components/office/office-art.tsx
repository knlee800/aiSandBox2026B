'use client';

import React from 'react';
import {
  officeScreenOn,
  officeShowTick,
  officeTint,
  type OfficeDeskPhase,
} from '@/lib/office/office.logic';

export const OFFICE_ART_MOTION_CSS = `
.office-desk-art,
.office-desk-art * {
  animation: none;
}
@media (prefers-reduced-motion: reduce) {
  .office-desk-art,
  .office-desk-art * {
    animation: none !important;
    transition: none !important;
  }
}
`;

export interface OfficeDeskArtProps {
  phase: OfficeDeskPhase;
  reducedMotion: boolean;
}

export default function OfficeDeskArt({ phase, reducedMotion }: OfficeDeskArtProps): React.ReactElement {
  const tint = officeTint(phase);
  const screenOn = officeScreenOn(phase);
  const showTick = officeShowTick(phase);
  const showFigure = phase !== 'vacant';

  return (
    <svg
      viewBox="0 0 120 88"
      aria-hidden="true"
      data-testid="office-desk-art"
      data-phase={phase}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      className="office-desk-art h-16 w-full"
      style={{ '--office-tint': tint } as React.CSSProperties}
    >
      <rect x="18" y="72" width="84" height="6" rx="2" fill="#020617" />
      <polygon points="14,60 106,60 114,74 6,74" fill="#1e293b" stroke="#334155" />
      <rect x="40" y="26" width="40" height="28" rx="2" fill="#0f172a" stroke="var(--office-tint)" />
      <rect
        x="44"
        y="30"
        width="32"
        height="18"
        fill={screenOn ? 'var(--office-tint)' : '#020617'}
      />
      <rect x="56" y="54" width="8" height="6" fill="#334155" />
      {showFigure ? (
        <>
          <circle cx="22" cy="34" r="6" fill="var(--office-tint)" />
          <rect x="14" y="42" width="16" height="16" rx="3" fill="#334155" />
        </>
      ) : null}
      {showTick ? (
        <path
          d="M50 40 l5 5 l10 -11"
          fill="none"
          stroke="#0f172a"
          strokeWidth="2"
        />
      ) : null}
    </svg>
  );
}
