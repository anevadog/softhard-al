-- La restricción de signo del libro de stock (migración add_stock_movements)
-- no contemplaba el motivo nuevo caducidad_pedido, que repone stock y por tanto
-- es positivo. Se recrea con el motivo añadido; el resto de reglas no cambia.
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_variation_sign";

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variation_sign" CHECK (
    ("reason" = 'venta' AND "variation" < 0)
    OR ("reason" IN ('stock_inicial', 'reposicion', 'cancelacion_pedido', 'caducidad_pedido') AND "variation" > 0)
    OR ("reason" = 'ajuste' AND "variation" <> 0)
);
