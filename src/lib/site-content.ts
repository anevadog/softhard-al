/** Contenido editable de la landing. Un solo sitio para copy y datos de contacto. */

export type ServiceIcon = "monitor" | "laptop" | "printer" | "box";

export type Service = {
  id: string;
  icon: ServiceIcon;
  title: string;
  description: string;
  features: readonly string[];
};

export const SERVICES: readonly Service[] = [
  {
    id: "ordenadores",
    icon: "monitor",
    title: "Reparación de ordenadores",
    description:
      "Torres y equipos de sobremesa: arranque, rendimiento, fuentes y limpieza interna.",
    features: ["Problemas de arranque y pantalla", "Cambio de disco a SSD", "Limpieza y pasta térmica"],
  },
  {
    id: "portatiles",
    icon: "laptop",
    title: "Reparación de portátiles",
    description:
      "Bisagras, teclados, baterías y pantallas. Dejamos tu portátil listo para trabajar.",
    features: ["Batería y teclado", "Sustitución de pantalla", "Recuperación de datos"],
  },
  {
    id: "impresoras",
    icon: "printer",
    title: "Reparación de impresoras",
    description:
      "Atascos, cabezales, tóner y configuración en red para casa o para la oficina.",
    features: ["Limpieza de cabezales", "Configuración Wi-Fi y red", "Mantenimiento preventivo"],
  },
  {
    id: "venta",
    icon: "box",
    title: "Venta de productos",
    description:
      "Equipos, periféricos y consumibles con asesoramiento según tu uso real.",
    features: ["Portátiles y sobremesas", "Periféricos y accesorios", "Tóner y consumibles"],
  },
];

export type Step = {
  title: string;
  description: string;
};

export const STEPS: readonly Step[] = [
  {
    title: "Cuenta y solicitud",
    description:
      "Crea tu cuenta y describe el equipo: tipo, marca, modelo y qué le pasa.",
  },
  {
    title: "Domicilio o taller",
    description:
      "Elige recogida a domicilio o entrega en taller y la franja horaria que te venga mejor.",
  },
  {
    title: "Diagnóstico y presupuesto",
    description:
      "Revisamos el equipo, te enviamos el presupuesto y decides sin compromiso.",
  },
  {
    title: "Reparación y entrega",
    description:
      "Si aceptas, reparamos y te avisamos cuando esté listo para recoger.",
  },
];

export const NAV_LINKS = [
  { href: "#servicios", label: "Servicios" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#contacto", label: "Contacto" },
] as const;

/** Datos ficticios: el proyecto es una demo de portfolio. */
export const CONTACT = {
  phone: "+34 910 000 000",
  phoneHref: "tel:+34910000000",
  email: "hola@softhard-al.demo",
  addressLines: ["Calle de Ejemplo 12", "28001 Madrid"],
  hours: ["Lun–Vie: 9:00–19:00", "Sábado: 10:00–14:00"],
} as const;

export const TRUST_POINTS: readonly string[] = [
  "Diagnóstico con importe fijo",
  "Presupuesto antes de reparar",
  "Recogida a domicilio o taller",
];

export type Feature = {
  title: string;
  description: string;
  icon: "shield" | "map-pin";
};

export const HIGHLIGHTS: readonly Feature[] = [
  {
    icon: "shield",
    title: "Diagnóstico transparente",
    description:
      "El diagnóstico tiene un importe fijo y se descuenta del presupuesto si aceptas la reparación. Si decides no repararlo, solo pagas el diagnóstico.",
  },
  {
    icon: "map-pin",
    title: "Domicilio o taller",
    description:
      "Puedes entregar el equipo en el taller o pedir que lo recojamos en tu domicilio. Tú eliges la modalidad al crear la solicitud.",
  },
];
