import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z, ZodError } from 'zod';

export class Problem extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function required(name: string) {
  const value = process.env[name];
  if (!value?.trim()) throw new Problem(503, 'configuration_required', `${name} is not configured.`);
  return value;
}
export function secureEqual(left: string, right: string) {
  const a = createHash('sha256').update(left).digest();
  const b = createHash('sha256').update(right).digest();
  return timingSafeEqual(a, b) && left.length > 0 && right.length > 0;
}
export function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
export function executionFingerprint(ctx: { sessionId: string; role: string; runId: string | null }, tool: string, args: unknown) {
  return hash(JSON.stringify({ tool, args, sessionId: ctx.sessionId, role: ctx.role, runId: ctx.runId }));
}
export function bearerAuth(name: string): RequestHandler {
  return (req, _res, next) => {
    const expected = required(name);
    if (!secureEqual(req.get('authorization') ?? '', `Bearer ${expected}`)) {
      throw new Problem(401, 'unauthorized', 'A valid access token is required.');
    }
    next();
  };
}
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const malformedJson = error instanceof SyntaxError && 'body' in error;
  const tooLarge = error?.type === 'entity.too.large';
  const status = error instanceof Problem ? error.status : tooLarge ? 413 : error instanceof ZodError || malformedJson ? 400 : 500;
  const code = error instanceof Problem ? error.code : status === 413 ? 'request_too_large' : status === 400 ? 'invalid_request' : 'internal_error';
  const message = status === 500 ? 'The request could not be completed.' : malformedJson ? 'The request body is not valid JSON.' : tooLarge ? 'The request body is too large.' : error.message;
  res.status(status).json({ ok: false, code, message, correlationId: res.locals.correlationId });
  if (status === 500) console.error(JSON.stringify({ code, path: req.path, correlationId: res.locals.correlationId }));
};
export function createApp(publicApi = false) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY_HOPS ? Number(process.env.TRUST_PROXY_HOPS) : 'loopback');
  app.use((_req, res, next) => {
    res.locals.correlationId = crypto.randomUUID();
    res.setHeader('X-Correlation-ID', res.locals.correlationId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  if (publicApi) app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' }));
  app.use(rateLimit({ windowMs: 60000, limit: publicApi ? 180 : 600, standardHeaders: 'draft-8', legacyHeaders: false }));
  return app;
}
export function signContext(payload: unknown) {
  const data = Buffer.from(JSON.stringify({ payload, expiresAt: Date.now() + 90000 })).toString('base64url');
  const signature = createHmac('sha256', required('INTERNAL_SERVICE_TOKEN')).update(data).digest('base64url');
  return `${data}.${signature}`;
}
export function verifyContext<Schema extends z.ZodTypeAny>(token: string, schema: Schema): z.output<Schema> {
  const [data, signature] = token.split('.');
  if (!data || !signature) throw new Problem(401, 'invalid_context', 'Missing tool authorization context.');
  const expected = createHmac('sha256', required('INTERNAL_SERVICE_TOKEN')).update(data).digest('base64url');
  if (!secureEqual(signature, expected)) throw new Problem(401, 'invalid_context', 'Invalid tool authorization context.');
  const decoded = z.object({ payload: z.unknown(), expiresAt: z.number() }).parse(JSON.parse(Buffer.from(data, 'base64url').toString()));
  if (decoded.expiresAt < Date.now()) throw new Problem(401, 'expired_context', 'Tool context expired.');
  return schema.parse(decoded.payload);
}
