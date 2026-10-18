/**
 * Eventos de seguridad de la cuenta.
 */

export interface PasswordChangedEvent {
  readonly userId: string;
  readonly changedByUserId: string;
  readonly changedAt: string;
}

export interface MfaEnabledEvent {
  readonly userId: string;
  readonly factorType: string;
}

export interface MfaDisabledEvent {
  readonly userId: string;
  readonly factorType: string;
  readonly disabledByUserId: string;
}

export interface AccountLockedEvent {
  readonly userId: string;
  readonly reason: string;
  readonly lockedByUserId?: string;
}

export interface PasswordResetRequestedEvent {
  readonly userId: string;
  readonly email: string;
  readonly requestedAt: string;
}
