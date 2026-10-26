import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcrypt";

import { PrismaClient } from "../src/generated/prisma/client";
import { evaluarSeed } from "../src/lib/seed-guard";
import { crearProductoSeedSiNoExiste } from "../src/server/data/seed-products";

const guardSeed = evaluarSeed();

if (!guardSeed.permitido) {
  if (guardSeed.motivo === "url-ausente") {
    console.error("Seed bloqueado: DATABASE_URL no está definida.");
  } else if (guardSeed.motivo === "url-invalida") {
    console.error("Seed bloqueado: DATABASE_URL no se puede interpretar.");
  } else {
    console.error(
      `Seed bloqueado: el host "${guardSeed.host}" no es local. ` +
        "Usa SEED_ALLOW_PRODUCTION=true solo si confirmas que quieres cargar los datos demo en esa base.",
    );
  }

  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

/** Contraseña única para todas las cuentas de demostración (solo datos ficticios). */
const DEMO_PASSWORD = "Demo1234!";

const DEMO_USERS = [
  { email: "cliente@demo.local", name: "Cliente Demo", role: "cliente" as const },
  { email: "trabajador@demo.local", name: "Trabajador Demo", role: "trabajador" as const },
  { email: "encargado@demo.local", name: "Encargado Demo", role: "encargado" as const },
  { email: "admin@demo.local", name: "Admin Demo", role: "admin" as const },
];

/** Productos ficticios para que el panel tenga datos desde el primer arranque. */
const DEMO_PRODUCTS = [
  {
    id: "demo-prod-thinkpad-t14",
    name: "Portátil Lenovo ThinkPad T14",
    description:
      "Portátil de 14 pulgadas con 16 GB de RAM y 512 GB SSD, ideal para trabajo y estudio.",
    price: "899.00",
    stock: 5,
    imageUrl: null,
    category: "portatiles" as const,
  },
  {
    id: "demo-prod-hp-elitedesk-800",
    name: "Ordenador HP EliteDesk 800",
    description:
      "Equipo de sobremesa compacto con Intel Core i5, 8 GB de RAM y 256 GB SSD.",
    price: "649.00",
    stock: 3,
    imageUrl: null,
    category: "ordenadores" as const,
  },
  {
    id: "demo-prod-epson-et-2850",
    name: "Impresora Epson EcoTank ET-2850",
    description:
      "Impresora multifunción de inyección de tinta con depósitos recargables y conexión Wi-Fi.",
    price: "279.00",
    stock: 8,
    imageUrl: null,
    category: "impresoras" as const,
  },
  {
    id: "demo-prod-toner-hp-26a",
    name: "Tóner HP 26A",
    description:
      "Cartucho de tóner negro original para impresoras HP LaserJet Pro.",
    price: "79.90",
    stock: 20,
    imageUrl: null,
    category: "consumibles" as const,
  },
  {
    id: "demo-prod-keychron-k2",
    name: "Teclado mecánico Keychron K2",
    description:
      "Teclado mecánico inalámbrico con retroiluminación y switches táctiles.",
    price: "49.90",
    stock: 12,
    imageUrl: null,
    category: "accesorios" as const,
  },
  {
    id: "demo-prod-monitor-lg-24",
    name: "Monitor LG 24 pulgadas",
    description:
      "Monitor LED Full HD de 24 pulgadas con panel IPS y conexión HDMI.",
    price: "129.00",
    stock: 0,
    imageUrl: null,
    category: "accesorios" as const,
  },
];

/**
 * Configuración de negocio por defecto (fila única con id = 1).
 * Idempotente: si la fila ya existe no se sobrescribe, para no pisar
 * valores ajustados a mano en local.
 */
async function seedConfig() {
  const config = await prisma.config.upsert({
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

  console.log(
    `Config lista: tarifa de diagnóstico = ${config.diagnosticFee} €, expiración = ${config.expirationDays} días, ` +
      `aviso sin actividad = ${config.inactiveRequestHours} h, fichaje abierto = ${config.openWorkLogHours} h`,
  );
}

/** Cuentas de demo para probar los roles sin UI de administración. */
async function seedDemoUsers() {
  const passwordHash = await hash(DEMO_PASSWORD, 12);

  for (const user of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
      },
    });
  }

  console.log(`Usuarios demo: ${DEMO_USERS.length} cuentas con contraseña "${DEMO_PASSWORD}"`);
}

/**
 * Catálogo de demostración. Idempotente: solo crea el producto si no existía.
 * El stock_inicial se registra únicamente en ese alta y con el stock demo,
 * nunca con el stock actual de la base.
 */
async function seedProducts() {
  let creados = 0;

  for (const product of DEMO_PRODUCTS) {
    const creado = await prisma.$transaction((tx) =>
      crearProductoSeedSiNoExiste(tx, product),
    );

    if (creado) {
      creados += 1;
    }
  }

  console.log(
    `Productos demo: ${DEMO_PRODUCTS.length} productos (${creados} creados en esta ejecución)`,
  );
}

async function main() {
  await seedConfig();
  await seedDemoUsers();
  await seedProducts();
}

main()
  .catch((error) => {
    console.error("Error ejecutando el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
