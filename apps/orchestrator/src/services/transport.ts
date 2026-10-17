import { MCPInvocationException } from '@armoriq/sdk';
import type { ArmorPort } from './authority';

export async function invokeWithTransportRetry(client: ArmorPort, ...args: Parameters<ArmorPort['invoke']>) {
  for (let attempt = 0; ; attempt++) {
    try { return await client.invoke(...args); }
    catch (error) {
      if (attempt >= 1 || !(error instanceof MCPInvocationException)
        || !error.statusCode || error.statusCode < 500 || error.statusCode > 599) throw error;
      // Reuse the exact signed authority and operation ID; MCP receipts prevent duplicate mutations.
      console.warn(JSON.stringify({ event: 'armoriq.transport_retry', tool: args[1], statusCode: error.statusCode }));
    }
  }
}
