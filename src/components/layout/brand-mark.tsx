export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      className={className}
      aria-hidden
    >
      <path d="M32 10 L52 21.5 V42.5 L32 54 L12 42.5 V21.5 Z" />
      <path d="M32 22 L42 28 V40 L32 46 L22 40 V28 Z" strokeWidth="2" opacity="0.7" />
      <circle cx="32" cy="34" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}
