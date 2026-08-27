/**
 * Security Module — Barrel Export
 * ────────────────────────────────
 * Import security components and hooks from this single entry point:
 *
 *   import {
 *     SensitiveContent,
 *     DynamicWatermark,
 *     ScreenVisibilityGuard,
 *     SecurityProvider,
 *     useSecurityContext,
 *     useScreenProtection,
 *     useVideoOverlayProtection,
 *   } from '../security';
 */

export { default as SensitiveContent } from './SensitiveContent';
export { default as DynamicWatermark } from './DynamicWatermark';
export { default as ScreenVisibilityGuard } from './ScreenVisibilityGuard';
export { SecurityProvider, useSecurityContext } from './SecurityContext';
export type { SecurityContextValue } from './SecurityContext';
export { useScreenProtection } from './useScreenProtection';
export type { ScreenProtectionState } from './useScreenProtection';
export { useVideoOverlayProtection } from './useVideoOverlayProtection';
