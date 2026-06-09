import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { VikunjaClient } from '../client.js';

const ticketIdSchema = z.string().describe('Ticket id in echo-N format, e.g. echo-3 or ECHO-3');

type ToolContent = { content: Array<{ type: 'text'; text: string }> };

function ticketLookupError(error: string): ToolContent {
  return { content: [{ type: 'text', text: error }] };
}

async function resolveTaskIdByTicketId(client: VikunjaClient, ticketId: string): Promise<number | ToolContent> {
  const resolved = await client.resolveSingleTaskByTicketId(ticketId);
  if (!resolved.ok) {
    return ticketLookupError(resolved.error);
  }
  return resolved.task.id;
}

export function labelTools(server: McpServer, client: VikunjaClient): void {
  server.registerTool('vikunja_list_labels', {
    description: 'List all labels the user has access to',
  }, async () => {
    const labels = await client.listLabels();
    if (!labels.length) return { content: [{ type: 'text', text: 'No labels found.' }] };

    const lines = labels.map(l => {
      const color = l.hex_color ? ` (${l.hex_color})` : '';
      return `[${l.id}] ${l.title}${color}`;
    }).join('\n');

    return {
      content: [{ type: 'text', text: `${labels.length} label(s):\n${lines}` }],
    };
  });

  server.registerTool('vikunja_create_label', {
    description: 'Create a new label',
    inputSchema: {
      title: z.string().describe('Label title'),
      hex_color: z.string().optional().describe('Hex color code (e.g., "#ff0000")'),
      description: z.string().optional().describe('Label description'),
    },
  }, async (data) => {
    const label = await client.createLabel(data);
    return {
      content: [{ type: 'text', text: `Created label [${label.id}] "${label.title}"` }],
    };
  });

  server.registerTool('vikunja_add_label_to_task', {
    description: 'Add a label to a task by numeric Vikunja task id',
    inputSchema: {
      task_id: z.number().describe('Task ID'),
      label_id: z.number().describe('Label ID'),
    },
  }, async ({ task_id, label_id }) => {
    const label = await client.addLabelToTask(task_id, label_id);
    return {
      content: [{ type: 'text', text: `Added label "${label.title}" to task #${task_id}` }],
    };
  });

  server.registerTool('vikunja_add_label_to_task_by_ticket_id', {
    description:
      'Add a label to a Project Echo ticket by its echo-N identifier (e.g. echo-3 or ECHO-3). ' +
      'Preferred over vikunja_add_label_to_task when you only know the ticket id.',
    inputSchema: {
      ticket_id: ticketIdSchema,
      label_id: z.number().describe('Label ID'),
    },
  }, async ({ ticket_id, label_id }) => {
    const resolved = await resolveTaskIdByTicketId(client, ticket_id);
    if (typeof resolved !== 'number') {
      return resolved;
    }
    const label = await client.addLabelToTask(resolved, label_id);
    return {
      content: [{ type: 'text', text: `Added label "${label.title}" to ticket "${ticket_id}" (#${resolved})` }],
    };
  });

  server.registerTool('vikunja_remove_label_from_task', {
    description: 'Remove a label from a task by numeric Vikunja task id',
    inputSchema: {
      task_id: z.number().describe('Task ID'),
      label_id: z.number().describe('Label ID'),
    },
  }, async ({ task_id, label_id }) => {
    await client.removeLabelFromTask(task_id, label_id);
    return {
      content: [{ type: 'text', text: `Removed label #${label_id} from task #${task_id}` }],
    };
  });

  server.registerTool('vikunja_remove_label_from_task_by_ticket_id', {
    description:
      'Remove a label from a Project Echo ticket by its echo-N identifier (e.g. echo-3 or ECHO-3). ' +
      'Preferred over vikunja_remove_label_from_task when you only know the ticket id.',
    inputSchema: {
      ticket_id: ticketIdSchema,
      label_id: z.number().describe('Label ID'),
    },
  }, async ({ ticket_id, label_id }) => {
    const resolved = await resolveTaskIdByTicketId(client, ticket_id);
    if (typeof resolved !== 'number') {
      return resolved;
    }
    await client.removeLabelFromTask(resolved, label_id);
    return {
      content: [{
        type: 'text',
        text: `Removed label #${label_id} from ticket "${ticket_id}" (#${resolved})`,
      }],
    };
  });
}
