-- CreatePurchaseOrderReception: Agrega campos de recepción a líneas de órdenes de compra
-- Solo agrega campos adicionales mínimos sin alterar estructura existente

ALTER TABLE purchase_order_lines
ADD COLUMN quantity_received DECIMAL(14,6),
ADD COLUMN received_at TIMESTAMPTZ(3);

COMMENT ON COLUMN purchase_order_lines.quantity_received IS 'Cantidad recibida (puede diferir de quantity_ordered)';
COMMENT ON COLUMN purchase_order_lines.received_at IS 'Timestamp de recepción de esta línea';

-- Índice para consultar líneas recibidas
CREATE INDEX purchase_order_lines_received_idx ON purchase_order_lines(purchase_order_id, received_at)
WHERE received_at IS NOT NULL;
