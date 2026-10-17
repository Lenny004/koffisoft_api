/**
 * Eventos del dominio de recursos.
 */

export interface ResourceMaintenanceDueEvent {
  readonly resourceId: string;
  readonly resourceName: string;
  readonly resourceCode: string;
  readonly locationId: string;
  readonly maintenanceScheduleId: string;
  readonly scheduledDate: string;
  readonly daysUntilDue: number;
}
