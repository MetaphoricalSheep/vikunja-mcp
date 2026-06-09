import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { VikunjaClient } from '../client.js';
import { formatTaskSummary } from '../ticket-utils.js';
import type { VikunjaTask } from '../types.js';

function formatTask(t: VikunjaTask): string {
  const status = t.done ? '[x]' : '[ ]';
  const identifier = t.identifier ? `${t.identifier} ` : '';
  const priority = t.priority > 0 ? ` P${t.priority}` : '';
  const due = t.due_date && !t.due_date.startsWith('0001') ? ` due:${t.due_date.split('T')[0]}` : '';
  const labels = t.labels?.length ? ` [${t.labels.map(l => l.title).join(', ')}]` : '';
  return `${status} ${identifier}#${t.id} ${t.title}${priority}${due}${labels}`;
}

export function taskTools(server: McpServer, client: VikunjaClient): void {
  server.registerTool('vikunja_get_task_by_ticket_id', {
    description:
      'Get a Project Echo ticket by its echo-N identifier (e.g. echo-3 or ECHO-3). ' +
      'Matches the Vikunja task identifier field exactly, case-insensitively. ' +
      'Use this for branch, plan, and implement workflows instead of search or numeric task id guessing.',
    inputSchema: {
      ticket_id: z.string().describe('Ticket id in echo-N format, e.g. echo-3 or ECHO-3'),
    },
  }, async ({ ticket_id }) => {
    const matches = await client.findTasksByTicketId(ticket_id);

    if (!matches.length) {
      return { content: [{ type: 'text', text: `No task found for ticket id "${ticket_id}".` }] };
    }

    if (matches.length > 1) {
      const lines = matches.map((task) => `${task.identifier} #${task.id} ${task.title}`).join('\n');
      return {
        content: [{
          type: 'text',
          text: `Multiple tasks matched ticket id "${ticket_id}":\n${lines}`,
        }],
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(formatTaskSummary(matches[0]), null, 2) }],
    };
  });

  server.registerTool('vikunja_list_tasks', {
    description:
      'List all tasks across all projects. Supports filtering and sorting. ' +
      'Do not use the s search parameter for Project Echo ticket lookup; it matches descriptions and can return the wrong task. ' +
      'Use vikunja_get_task_by_ticket_id for echo-N lookups.',
    inputSchema: {
      page: z.number().optional().describe('Page number (default: 1)'),
      per_page: z.number().optional().describe('Tasks per page (default: 50)'),
      s: z.string().optional().describe('Full-text search query. Avoid for echo-N ticket lookup.'),
      sort_by: z.string().optional().describe('Sort field (e.g., "due_date", "created", "priority")'),
      order_by: z.string().optional().describe('Sort order: "asc" or "desc"'),
      filter: z.string().optional().describe('Vikunja filter string (e.g., "done = false")'),
    },
  }, async (params) => {
    const tasks = await client.listTasks(params);
    if (!tasks.length) return { content: [{ type: 'text', text: 'No tasks found.' }] };

    const lines = tasks.map(formatTask).join('\n');
    return {
      content: [{ type: 'text', text: `${tasks.length} task(s):\n${lines}` }],
    };
  });

  server.registerTool('vikunja_list_project_tasks', {
    description:
      'List tasks within a specific project. The default project view may hide completed tasks. ' +
      'For echo-N ticket lookup, use vikunja_get_task_by_ticket_id instead.',
    inputSchema: {
      project_id: z.number().describe('Project ID'),
      page: z.number().optional().describe('Page number'),
      per_page: z.number().optional().describe('Tasks per page'),
      filter: z.string().optional().describe('Vikunja filter string'),
    },
  }, async ({ project_id, ...params }) => {
    const views = await client.getProjectViews(project_id);
    if (!views.length) return { content: [{ type: 'text', text: 'Project has no views.' }] };

    const tasks = await client.listProjectTasks(project_id, views[0].id, params);
    if (!tasks.length) return { content: [{ type: 'text', text: 'No tasks in this project.' }] };

    const lines = tasks.map(formatTask).join('\n');
    return {
      content: [{ type: 'text', text: `${tasks.length} task(s) in project #${project_id}:\n${lines}` }],
    };
  });

  server.registerTool('vikunja_get_task', {
    description:
      'Get detailed information about a specific task by numeric Vikunja task id. ' +
      'The echo-N ticket number is not the numeric task id; use vikunja_get_task_by_ticket_id for echo-N lookups.',
    inputSchema: {
      id: z.number().describe('Numeric Vikunja task ID'),
    },
  }, async ({ id }) => {
    const task = await client.getTask(id);
    return {
      content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
    };
  });

  server.registerTool('vikunja_create_task', {
    description: 'Create a new task in a project',
    inputSchema: {
      project_id: z.number().describe('Project ID to create the task in'),
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Task description (supports markdown)'),
      done: z.boolean().optional().describe('Mark as completed'),
      priority: z.number().optional().describe('Priority: 0=none, 1=low, 2=medium, 3=high, 4=urgent'),
      due_date: z.string().optional().describe('Due date in ISO format (e.g., "2026-03-15T00:00:00Z")'),
      hex_color: z.string().optional().describe('Hex color code'),
    },
  }, async ({ project_id, ...data }) => {
    const task = await client.createTask(project_id, data);
    return {
      content: [{ type: 'text', text: `Created task [${task.id}] "${task.title}" in project #${project_id}` }],
    };
  });

  server.registerTool('vikunja_update_task', {
    description: 'Update an existing task',
    inputSchema: {
      id: z.number().describe('Task ID'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      done: z.boolean().optional().describe('Mark as done/undone'),
      priority: z.number().optional().describe('Priority: 0=none, 1=low, 2=medium, 3=high, 4=urgent'),
      due_date: z.string().optional().describe('Due date in ISO format'),
      hex_color: z.string().optional().describe('Hex color code'),
    },
  }, async ({ id, ...data }) => {
    const task = await client.updateTask(id, data);
    return {
      content: [{ type: 'text', text: `Updated task [${task.id}] "${task.title}"` }],
    };
  });

  server.registerTool('vikunja_complete_task', {
    description: 'Mark a task as completed',
    inputSchema: {
      id: z.number().describe('Task ID to complete'),
    },
  }, async ({ id }) => {
    const task = await client.updateTask(id, { done: true });
    return {
      content: [{ type: 'text', text: `Completed task [${task.id}] "${task.title}"` }],
    };
  });

  server.registerTool('vikunja_delete_task', {
    description: 'Delete a task',
    inputSchema: {
      id: z.number().describe('Task ID to delete'),
    },
  }, async ({ id }) => {
    await client.deleteTask(id);
    return {
      content: [{ type: 'text', text: `Deleted task #${id}` }],
    };
  });

  server.registerTool('vikunja_bulk_create_tasks', {
    description: 'Create multiple tasks at once in a project',
    inputSchema: {
      project_id: z.number().describe('Project ID to create tasks in'),
      tasks: z.array(z.object({
        title: z.string().describe('Task title'),
        description: z.string().optional().describe('Task description'),
        done: z.boolean().optional().describe('Mark as completed'),
        priority: z.number().optional().describe('Priority (0-4)'),
        due_date: z.string().optional().describe('Due date in ISO format'),
      })).describe('Array of tasks to create'),
    },
  }, async ({ project_id, tasks }) => {
    const results: string[] = [];
    for (const taskData of tasks) {
      const task = await client.createTask(project_id, taskData);
      results.push(`[${task.id}] ${task.title}`);
    }
    return {
      content: [{ type: 'text', text: `Created ${results.length} task(s) in project #${project_id}:\n${results.join('\n')}` }],
    };
  });
}
