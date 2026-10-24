import type { OrderStatus } from "@/generated/prisma/enums";
import { ORDER_STATUS_META } from "@/lib/orders";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, badgeClass } = ORDER_STATUS_META[status];

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badgeClass}`}
    >
      {label}
    </span>
  );
}
