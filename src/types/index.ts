/**
 * Shared type definitions for AI Browser Guard.
 *
 * This module re-exports all type definitions used across the extension,
 * providing a single import point for shared types.
 */

export type {
  AgentIdentity,
  AgentType,
  DetectionMethod,
  DetectionConfidence,
  AgentCapability,
} from './agent';

export type {
  DelegationPreset,
  DelegationRule,
  DelegationToken,
  DelegationScope,
  ActionRestriction,
  SitePattern,
  TimeBound,
} from './delegation';

export type {
  AgentEvent,
  AgentEventType,
  BoundaryViolation,
  KillSwitchEvent,
  DetectionEvent,
  MessagePayload,
  MessageType,
} from './events';
