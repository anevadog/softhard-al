import type { ServiceStatus } from "@/generated/prisma/enums";
import { SERVICE_STATUS_META } from "@/lib/service-requests";

export function StatusBadge({ status }: { status: ServiceStatus }) {
  const { label, badgeClass } = SERVICE_STATUS_META[status];

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badgeClass}`}
    >
      {label}
    </span>
  );
}
