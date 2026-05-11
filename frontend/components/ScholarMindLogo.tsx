'use client';

export default function ScholarMindLogo({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="smGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#888888" />
        </linearGradient>
        <style>{`
          @keyframes sm-spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @keyframes sm-spin-rev {
            from { transform: rotate(0deg); }
            to   { transform: rotate(-360deg); }
          }
          @keyframes sm-pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.75; }
          }
          .sm-outer {
            transform-origin: 32px 32px;
            animation: sm-spin 12s linear infinite, sm-pulse 4s ease-in-out infinite;
          }
          .sm-inner {
            transform-origin: 32px 32px;
            animation: sm-spin-rev 8s linear infinite;
          }
          .sm-core {
            transform-origin: 32px 32px;
            animation: sm-spin 20s linear infinite, sm-pulse 3s ease-in-out infinite;
          }
        `}</style>
      </defs>

      {/* Outer organic ring */}
      <g className="sm-outer">
        <path
          d="M32 6 C44 6 56 18 54 30 C52 42 44 52 32 54 C20 56 8 46 8 34 C8 22 18 8 32 6 Z"
          fill="none"
          stroke="url(#smGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M32 10 C48 10 52 22 50 32 C48 44 38 52 26 50 C14 48 10 36 12 26 C14 16 22 10 32 10 Z"
          fill="none"
          stroke="url(#smGrad)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.35"
          strokeDasharray="4 6"
        />
      </g>

      {/* Inner flowing arcs */}
      <g className="sm-inner">
        <path
          d="M32 18 C40 18 46 24 46 32 C46 40 40 46 32 46 C24 46 18 40 18 32 C18 24 24 18 32 18 Z"
          fill="none"
          stroke="url(#smGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
          strokeDasharray="10 4"
        />
        <path
          d="M20 24 C26 16 42 18 46 28 C50 38 44 50 34 52"
          fill="none"
          stroke="#aaaaaa"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
        />
      </g>

      {/* Core glow dot */}
      <g className="sm-core">
        <circle cx="32" cy="32" r="6" fill="url(#smGrad)" opacity="0.9" />
        <circle cx="32" cy="32" r="3" fill="#ffffff" opacity="0.4" />
        {/* Small orbiting accent */}
        <circle cx="32" cy="22" r="2.5" fill="#ffffff" opacity="0.7" />
      </g>
    </svg>
  );
}
