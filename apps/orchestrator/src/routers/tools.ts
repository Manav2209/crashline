import { Router } from 'express';
import { toolRequestSchema } from '@crashline/contracts';
import { Problem } from '@crashline/server';
import { resolveContext } from '../services/context';
import { invokeTool } from '../services/gateway';

export const toolsRouter = Router();
toolsRouter.post('/execute', async (req, res) => {
  const input = toolRequestSchema.parse(req.body);
  if (input.tool === 'claims.approve_settlement' && process.env.DEMO_ATTACK_ENABLED !== 'true') {
    throw new Problem(404, 'disabled', 'The sandbox attack harness is disabled.');
  }
  const ctx = await resolveContext(input.sessionId, 'INTAKE', input.correlationId, input.operationId);
  res.json(await invokeTool(ctx, input.tool, input.args));
});
