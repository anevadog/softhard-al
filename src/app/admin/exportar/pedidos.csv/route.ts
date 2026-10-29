import { exportarPedidos } from "@/server/exports/csv-exports";

/** Una fila por línea de pedido, por fecha de creación del pedido. */
export const GET = exportarPedidos;
