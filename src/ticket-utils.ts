import type { VikunjaTask } from './types.js';

const TICKET_ID_PATTERN = /^echo-\d+$/;

export interface BlockerSummary {
  id: number;
  identifier: string;
  title: string;
  done: boolean;
}

export interface BlockerStatus {
  blockers: BlockerSummary[];
  all_blockers_complete: boolean;
  is_blocked: boolean;
}

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

function blockerIdentifier(task: VikunjaTask): string {
  const identifier = (task.identifier ?? '').trim();
  if (identifier) {
    return identifier.toUpperCase();
  }
  if (task.index > 0) {
    return `ECHO-${task.index}`;
  }
  return '';
}

export function extractBlockerStatus(task: VikunjaTask): BlockerStatus {
  const blockers = (task.related_tasks?.blocked ?? []).map((blocker) => ({
    id: blocker.id,
    identifier: blockerIdentifier(blocker),
    title: blocker.title,
    done: blocker.done,
  }));

  const all_blockers_complete = blockers.length === 0 || blockers.every((blocker) => blocker.done);

  return {
    blockers,
    all_blockers_complete,
    is_blocked: !all_blockers_complete,
  };
}

export function formatTaskSummary(task: VikunjaTask): Record<string, unknown> {
  const blockerStatus = extractBlockerStatus(task);

  return {
    id: task.id,
    identifier: task.identifier,
    title: task.title,
    description: task.description,
    done: task.done,
    project_id: task.project_id,
    labels: (task.labels ?? []).map((label) => label.title),
    blockers: blockerStatus.blockers,
    all_blockers_complete: blockerStatus.all_blockers_complete,
    is_blocked: blockerStatus.is_blocked,
  };
}
