/** Evento emitido al crear una orden de compra. */
export interface PurchaseOrderCreatedEvent {
  purchaseOrderId: string;
  locationId: string;
  supplierId: string;
  supplierName: string;
  orderNumber: string;
  totalAmount: string;
}

/** Evento emitido al aprobar una orden de compra. */
export interface PurchaseOrderApprovedEvent {
  purchaseOrderId: string;
  orderNumber: string;
  approvedByUserId: string;
  totalAmount: string;
}

/** Evento emitido al recibir una orden de compra. */
export interface PurchaseOrderReceivedEvent {
  purchaseOrderId: string;
  orderNumber: string;
  supplierId: string;
  locationId: string;
  linesReceived: number;
  totalQuantityReceived: string;
}
