import type { ReactNode } from 'react'

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconScan = () => (
  <Svg>
    <path d="M4 8V6a2 2 0 0 1 2-2h2" />
    <path d="M16 4h2a2 2 0 0 1 2 2v2" />
    <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
    <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
    <line x1="4" y1="12" x2="20" y2="12" />
  </Svg>
)

export const IconZones = () => (
  <Svg>
    <path d="M12 21s-6-5.1-6-10a6 6 0 1 1 12 0c0 4.9-6 10-6 10z" />
    <circle cx="12" cy="11" r="2.2" />
  </Svg>
)

export const IconStore = () => (
  <Svg>
    <path d="M3.5 9 5 4.5A1 1 0 0 1 6 4h12a1 1 0 0 1 .95.68L20.5 9" />
    <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
    <path d="M9.5 20v-5h5v5" />
  </Svg>
)

export const IconAudit = () => (
  <Svg>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <path d="M8.4 11.2l1.9 1.9 3.4-3.6" />
  </Svg>
)

export const IconReport = () => (
  <Svg>
    <path d="M4 4v16h16" />
    <rect x="7" y="12" width="2.6" height="5" rx="0.5" />
    <rect x="11.7" y="8" width="2.6" height="9" rx="0.5" />
    <rect x="16.4" y="5" width="2.6" height="12" rx="0.5" />
  </Svg>
)

export const IconTeam = () => (
  <Svg>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.4a3 3 0 0 1 0 5.6" />
    <path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 20" />
  </Svg>
)
