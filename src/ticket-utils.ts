import type { VikunjaTask } from './types.js';

const TICKET_ID_PATTERN = /^echo-\d+$/;

export function normalizeTicketId(ticketId: string): string {
  const normalized = ticketId.trim().toLowerCase();
  if (!TICKET_ID_PATTERN.test(normalized)) {
    throw new Error(`Invalid ticket id "${ticketId}". Expected format echo-N.`);
  }
  return normalized;
}

export function taskMatchesTicketId(task: VikunjaTask, normalizedTicketId: string): boolean {
  return (task.identifier ?? '').toLowerCase() === normalizedTicketId;
}

export function formatTaskSummary(task: VikunjaTask): Record<string, unknown> {
  return {
    id: task.id,
    identifier: task.identifier,
    title: task.title,
    description: task.description,
    done: task.done,
    project_id: task.project_id,
    labels: (task.labels ?? []).map((label) => label.title),
  };
}
