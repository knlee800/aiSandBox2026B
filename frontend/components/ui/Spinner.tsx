import React from 'react';

export interface SpinnerProps {
  /** Translated text for screen readers. Omit when a visible sentence sits next to the spinner. */
  label?: string;
  /** Tailwind size and color utilities. Defaults to a small spinner in the current text color. */
  className?: string;
}

/**
 * The one shared loading spinner (DESIGN.md Known gap 9).
 * The SVG is decorative (`aria-hidden`); the label, when given, is the accessible name.
 * Motion is turned off under prefers-reduced-motion.
 */
export default function Spinner({ label, className = 'h-4 w-4' }: SpinnerProps) {
  return (
    <span className="inline-flex items-center" data-testid="ui-spinner" {...(label ? { role: 'status' } : {})}>
      <svg
        aria-hidden="true"
        className={`${className} shrink-0 animate-spin motion-reduce:animate-none`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
