import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { armorAction, toolSchemas, type ToolName } from '@crashline/contracts';
import { Problem } from '@crashline/server';
import { z } from 'zod';
import { executeTool } from './services/tools';

export function createInsuranceServer(executor = executeTool) {
  const server = new McpServer({ name: 'insurance-mcp', version: '0.1.0' });
  for (const tool of Object.keys(toolSchemas) as ToolName[]) {
    for (const name of [tool, armorAction(tool)]) {
    server.registerTool(name, {
      description: `${tool}. Synthetic insurance data only. Requires a server-signed authorization context.`,
      inputSchema: { ...toolSchemas[tool].shape, _authorization: z.string() },
    }, async (args: Record<string, unknown>) => {
      try {
        const result = await executor(tool, args);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
      } catch (error) {
        const message = error instanceof Problem ? error.message : 'Tool execution failed. No success is claimed.';
        return { isError: true, content: [{ type: 'text' as const, text: message }] };
      }
    });
    }
  }
  return server;
}
