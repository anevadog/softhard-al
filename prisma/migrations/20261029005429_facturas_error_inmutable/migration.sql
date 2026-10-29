-- El trigger de inmutabilidad lanzaba su error con ERRCODE restrict_violation
-- (23001), que Prisma traduce como "Foreign key constraint violated" y oculta
-- el motivo real. Se recrea la función con el código genérico de RAISE
-- (P0001, raise_exception), que conserva el mensaje. La lógica no cambia: los
-- triggers siguen apuntando a la misma función.
CREATE OR REPLACE FUNCTION "facturas_inmutables"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('softhard.permitir_borrado_facturas', true) = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Las facturas son inmutables: % no permitido en %', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
