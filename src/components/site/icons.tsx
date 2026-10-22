import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Marca de la web: chip de circuito. */
export function CpuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </Icon>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
      <path d="M8.5 20.5h7M12 16.5v4" />
    </Icon>
  );
}

export function LaptopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4.5" width="16" height="11" rx="1.75" />
      <path d="M2 19.5h20" />
    </Icon>
  );
}

export function PrinterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 9V3.5h10V9" />
      <rect x="3.5" y="9" width="17" height="8" rx="2" />
      <rect x="7" y="14" width="10" height="6.5" rx="1" />
    </Icon>
  );
}

export function BoxIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 8.4v7.2a1.6 1.6 0 0 1-.8 1.4l-7.4 4.1a1.6 1.6 0 0 1-1.6 0L3.8 17a1.6 1.6 0 0 1-.8-1.4V8.4a1.6 1.6 0 0 1 .8-1.4l7.4-4.1a1.6 1.6 0 0 1 1.6 0l7.4 4.1a1.6 1.6 0 0 1 .8 1.4Z" />
      <path d="m3.4 7.5 8.6 4.8 8.6-4.8M12 12.3V20.8" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m20 6.5-11 11-5-5" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21.5s7.5-3.7 7.5-9.4V5.6L12 2.5 4.5 5.6v6.5c0 5.7 7.5 9.4 7.5 9.4Z" />
      <path d="m9 11.8 2.1 2.1 4.1-4.1" />
    </Icon>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 10.4c0 5.6-8 11.1-8 11.1s-8-5.5-8-11.1a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10.2" r="2.9" />
    </Icon>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21.5 16.9v2.6a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.6 3.7a2 2 0 0 1 2-2.2h2.6a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L7.3 9.2a16 16 0 0 0 6 6l1.2-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="m3 6.5 9 6.5 9-6.5" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 6.8V12l3.6 2.2" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />
    </Icon>
  );
}
