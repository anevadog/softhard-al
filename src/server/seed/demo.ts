import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { crearProductoSeedSiNoExiste, type ProductoSeed } from "@/server/data/seed-products";

type Tx = Prisma.TransactionClient;

/** Contraseña única para todas las cuentas de demostración (solo datos ficticios). */
export const DEMO_PASSWORD = "Demo1234!";

type UsuarioDemo = { email: string; name: string; role: Role; nif?: string };

export const DEMO_USERS: readonly UsuarioDemo[] = [
  { email: "cliente@demo.local", name: "Cliente Demo", role: "cliente" },
  { email: "trabajador@demo.local", name: "Trabajador Demo", role: "trabajador" },
  { email: "encargado@demo.local", name: "Encargado Demo", role: "encargado" },
  { email: "admin@demo.local", name: "Admin Demo", role: "admin" },
  // Clientes del histórico (4.3b): dos con NIF para tener facturas completas.
  { email: "cliente2@demo.local", name: "Lucía Martín (demo)", role: "cliente", nif: "12345678Z" },
  { email: "cliente3@demo.local", name: "Javier Ortega (demo)", role: "cliente" },
  { email: "cliente4@demo.local", name: "Marta Ruiz (demo)", role: "cliente", nif: "87654321X" },
  { email: "cliente5@demo.local", name: "Pablo Sanz (demo)", role: "cliente" },
  { email: "cliente6@demo.local", name: "Elena Gil (demo)", role: "cliente" },
];

/** Productos ficticios para que el panel tenga datos desde el primer arranque. */
export const DEMO_PRODUCTS: readonly ProductoSeed[] = [
  {
    id: "demo-prod-thinkpad-t14",
    name: "Portátil Lenovo ThinkPad T14",
    description:
      "Portátil de 14 pulgadas con 16 GB de RAM y 512 GB SSD, ideal para trabajo y estudio.",
    price: "899.00",
    stock: 5,
    imageUrl: null,
    category: "portatiles",
  },
  {
    id: "demo-prod-hp-elitedesk-800",
    name: "Ordenador HP EliteDesk 800",
    description:
      "Equipo de sobremesa compacto con Intel Core i5, 8 GB de RAM y 256 GB SSD.",
    price: "649.00",
    stock: 3,
    imageUrl: null,
    category: "ordenadores",
  },
  {
    id: "demo-prod-epson-et-2850",
    name: "Impresora Epson EcoTank ET-2850",
    description:
      "Impresora multifunción de inyección de tinta con depósitos recargables y conexión Wi-Fi.",
    price: "279.00",
    stock: 8,
    imageUrl: null,
    category: "impresoras",
  },
  {
    id: "demo-prod-toner-hp-26a",
    name: "Tóner HP 26A",
    description:
      "Cartucho de tóner negro original para impresoras HP LaserJet Pro.",
    price: "79.90",
    stock: 20,
    imageUrl: null,
    category: "consumibles",
  },
  {
    id: "demo-prod-keychron-k2",
    name: "Teclado mecánico Keychron K2",
    description:
      "Teclado mecánico inalámbrico con retroiluminación y switches táctiles.",
    price: "49.90",
    stock: 12,
    imageUrl: null,
    category: "accesorios",
  },
  {
    id: "demo-prod-monitor-lg-24",
    name: "Monitor LG 24 pulgadas",
    description:
      "Monitor LED Full HD de 24 pulgadas con panel IPS y conexión HDMI.",
    price: "129.00",
    stock: 0,
    imageUrl: null,
    category: "accesorios",
  },
];

/**
 * Configuración de negocio por defecto (fila única con id = 1).
 * Idempotente: si la fila ya existe no se sobrescribe, para no pisar
 * valores ajustados a mano en local.
 */
export async function sembrarConfig(tx: Tx) {
  return tx.config.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      diagnosticFee: 30,
      expirationDays: 7,
      inactiveRequestHours: 48,
      openWorkLogHours: 8,
    },
  });
}

/** Cuentas de demo para probar los roles sin UI de administración. */
export async function sembrarUsuarios(tx: Tx, passwordHash: string): Promise<number> {
  for (const user of DEMO_USERS) {
    await tx.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        nif: user.nif ?? null,
        passwordHash,
      },
    });
  }

  return DEMO_USERS.length;
}

/**
 * Catálogo de demostración. Idempotente: solo crea el producto si no existía.
 * El stock_inicial se registra únicamente en ese alta y con el stock demo,
 * nunca con el stock actual de la base. Devuelve cuántos ha creado.
 */
export async function sembrarProductos(tx: Tx): Promise<number> {
  let creados = 0;

  for (const product of DEMO_PRODUCTS) {
    if (await crearProductoSeedSiNoExiste(tx, product)) {
      creados += 1;
    }
  }

  return creados;
}
