export default function LogoMark({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chisko owl logomark"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="chiskoLogoGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="#00A36C" />

      <path className="logo-tuft-l" d="M21 18 L16 7 L28 15 Z" fill="#F59E0B" stroke="#0B7A52" strokeWidth="1.6" strokeLinejoin="round" />
      <path className="logo-tuft-r" d="M43 18 L48 7 L36 15 Z" fill="#F59E0B" stroke="#0B7A52" strokeWidth="1.6" strokeLinejoin="round" />

      <ellipse cx="32" cy="37" rx="20" ry="21" fill="url(#chiskoLogoGrad)" stroke="#0B7A52" strokeWidth="2" />

      <path d="M32 39 L36 43.5 L32 49 L28 43.5 Z" fill="#D97706" />

      <circle cx="23" cy="33" r="8" fill="#FFFFFF" />
      <circle cx="41" cy="33" r="8" fill="#FFFFFF" />
      <circle cx="23.6" cy="34" r="3.2" fill="#1E293B" />
      <circle cx="41.6" cy="34" r="3.2" fill="#1E293B" />
      <circle cx="24.7" cy="33" r="1" fill="#FFFFFF" />
      <circle cx="42.7" cy="33" r="1" fill="#FFFFFF" />
      <circle cx="23" cy="33" r="8" fill="none" stroke="#1E293B" strokeWidth="2.2" />
      <circle cx="41" cy="33" r="8" fill="none" stroke="#1E293B" strokeWidth="2.2" />
      <path d="M30.5 32 Q32 29.8 33.5 32" fill="none" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
