/**
 * ID generation utilities for the voice gateway.
 * Centralizes ID creation patterns for consistency and maintainability.
 */

/**
 * Generate a unique message/event ID.
 * Format: timestamp-randomSuffix
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a unique order ID with type prefix.
 * Format: order-{type}-timestamp-randomSuffix
 */
export function generateOrderId(orderType: string): string {
  return `order-${orderType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Generate a transcript entry ID.
 * Format: transcript-timestamp-randomSuffix
 */
export function generateTranscriptId(): string {
  return `transcript-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Generate a treatment history entry ID.
 * Format: treatment-timestamp-randomSuffix
 */
export function generateTreatmentId(): string {
  return `treatment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
