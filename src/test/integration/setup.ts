import { afterAll } from "vitest";

import { cerrarConexion } from "@/test/integration/db";

afterAll(async () => {
  await cerrarConexion();
});
