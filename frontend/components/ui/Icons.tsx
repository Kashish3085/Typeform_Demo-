// Small inline-SVG icon set (no dependency). All icons are 24x24, stroke = currentColor.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconSparkle = (p: P) => (
  <Svg {...p}>
    <path d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8L10 3z" />
    <path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14z" />
  </Svg>
);
export const IconSearch = (p: P) => (<Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></Svg>);
export const IconPlus = (p: P) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>);
export const IconClose = (p: P) => (<Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>);
export const IconDots = (p: P) => (
  <Svg {...p} fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></Svg>
);
export const IconChevronDown = (p: P) => (<Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>);
export const IconCaretUp = (p: P) => (<Svg {...p} fill="currentColor" stroke="none"><path d="M7 14l5-6 5 6z" /></Svg>);
export const IconList = (p: P) => (<Svg {...p}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></Svg>);
export const IconGrid = (p: P) => (<Svg {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></Svg>);
export const IconCalendar = (p: P) => (<Svg {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></Svg>);
export const IconHelp = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01" /></Svg>);
export const IconMic = (p: P) => (<Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></Svg>);
export const IconSend = (p: P) => (<Svg {...p}><path d="M4 4l16 8-16 8 3-8-3-8zM7 12h8" /></Svg>);
export const IconUserPlus = (p: P) => (<Svg {...p}><circle cx="10" cy="8" r="3.5" /><path d="M3.5 20a6.5 6.5 0 0113 0M18 8v6M15 11h6" /></Svg>);
export const IconCollapse = (p: P) => (<Svg {...p}><path d="M14 10l6-6M20 9V4h-5M10 14l-6 6M4 15v5h5" /></Svg>);
export const IconForms = (p: P) => (<Svg {...p}><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M7 10h4M7 14h10" /></Svg>);
export const IconContacts = (p: P) => (<Svg {...p}><circle cx="9" cy="9" r="3" /><path d="M3.5 19a5.5 5.5 0 0111 0" /><circle cx="17" cy="10" r="2.3" /><path d="M16 15.2a4.6 4.6 0 014.6 3.8" /></Svg>);
export const IconAutomations = (p: P) => (<Svg {...p}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="12" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M8.3 7l7.4 3.8M8.3 17l7.4-3.8" /></Svg>);
export const IconInsights = (p: P) => (<Svg {...p}><path d="M4 4v16h16" /><path d="M7 15l4-4 3 3 5-6" /></Svg>);
export const IconPages = (p: P) => (<Svg {...p}><rect x="4" y="4" width="13" height="16" rx="2" /><path d="M9 9h5M9 13h5M17 8h3v10a2 2 0 01-2 2" /></Svg>);
export const IconResearch = (p: P) => (<Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.8-3.8M8.5 11h5M11 8.5v5" /></Svg>);
export const IconIntegrations = (p: P) => (<Svg {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><path d="M16.7 13.5v6.5M13.5 16.7H20" /></Svg>);
export const IconBrand = (p: P) => (<Svg {...p}><path d="M4 10h16v9a1 1 0 01-1 1H5a1 1 0 01-1-1v-9zM8 10V7a4 4 0 018 0v3" /></Svg>);
export const IconDiamond = (p: P) => (<Svg {...p}><path d="M12 4l7 8-7 8-7-8 7-8z" /><path d="M9.5 12L12 9l2.5 3" /></Svg>);
