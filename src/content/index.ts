/**
 * Content script entry point.
 *
 * Injected into every page at document_start. Initializes the detection
 * engine and boundary monitor, then relays results to the background
 * service worker.
 */

import type { MessagePayload, MessageType } from '../types/events';
import { startDetectionMonitor } from './detector';
import type { DetectionVerdictResult } from './detector';
import { startBoundaryMonitor, updateActiveRule, getMonitorState } from './monitor';
import { executeContentKillSwitch, registerCleanup } from '../killswitch/index';
import type { DelegationRule } from '../types/delegation';

let detectionCleanup: (() => void) | null = null;
let monitorCleanup: (() => void) | null = null;
let currentAgentId: string | null = null;

function initialize(): void {
  // Set up message listener for background communication
  chrome.runtime.onMessage.addListener(handleMessage);

  const startMonitoring = () => {
    // Start detection monitor
    detectionCleanup = startDetectionMonitor({}, onDetectionResult);
    registerCleanup(() => {
      if (detectionCleanup) detectionCleanup();
    });

    // Start boundary monitor (no rule initially = fail-closed)
    monitorCleanup = startBoundaryMonitor(
      null,
      (violation) => {
        sendToBackground('BOUNDARY_CHECK_REQUEST', violation);
      },
      (event) => {
        sendToBackground('AGENT_ACTION', event);
      }
    );
    registerCleanup(() => {
      if (monitorCleanup) monitorCleanup();
    });

    // Request active delegation rules from background
    sendToBackground('STATUS_QUERY', {}).then((response) => {
      if (response && typeof response === 'object') {
        const data = response as { activeDelegation?: DelegationRule };
        if (data.activeDelegation) {
          updateActiveRule(data.activeDelegation);
        }
      }
    }).catch(() => {
      // Background may not be ready
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMonitoring, { once: true });
  } else {
    startMonitoring();
  }

  console.log('[AI Browser Guard] Content script initialized');
}

async function sendToBackground(type: MessageType, data: unknown): Promise<unknown> {
  const message: MessagePayload = {
    type,
    data,
    sentAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

function handleMessage(
  message: MessagePayload,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean {
  if (!message || !message.type) return false;

  switch (message.type) {
    case 'DELEGATION_UPDATE': {
      const rule = message.data as DelegationRule | null;
      updateActiveRule(rule);

      // Restart monitor with new rule
      if (monitorCleanup) monitorCleanup();
      monitorCleanup = startBoundaryMonitor(
        rule,
        (violation) => sendToBackground('BOUNDARY_CHECK_REQUEST', violation),
        (event) => sendToBackground('AGENT_ACTION', event)
      );
      sendResponse({ success: true });
      return false;
    }

    case 'KILL_SWITCH_ACTIVATE': {
      // Stop all monitoring and clean up
      const result = executeContentKillSwitch();
      detectionCleanup = null;
      monitorCleanup = null;
      currentAgentId = null;
      sendResponse({ success: true, ...result });
      return false;
    }

    case 'STATUS_QUERY': {
      const state = getMonitorState();
      sendResponse({
        agentDetected: currentAgentId !== null,
        agentId: currentAgentId,
        monitorState: state,
      });
      return false;
    }

    default:
      return false;
  }
}

function onDetectionResult(verdict: DetectionVerdictResult): void {
  if (verdict.agentDetected && verdict.agent) {
    currentAgentId = verdict.agent.id;
    sendToBackground('DETECTION_RESULT', verdict.event).catch(() => {
      // Background may not be available
    });
  }
}

initialize();
