import type { Config, Context } from '@netlify/functions';
import serverless from 'serverless-http';

type ApplicationResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  cookies?: string[];
  body: string;
  isBase64Encoded?: boolean;
};

export default async (request: Request, context: Context) => {
  const { default: app } = await import('../../server.js');
  const handler = serverless(app);
  const url = new URL(request.url);
  const result = await handler({
    version: '2.0',
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers: Object.fromEntries(request.headers),
    body: Buffer.from(await request.arrayBuffer()).toString('base64'),
    isBase64Encoded: true,
    requestContext: {
      requestId: context.requestId,
      http: {
        method: request.method,
        sourceIp: context.ip
      }
    }
  }, {}) as ApplicationResponse;

  const headers = new Headers(result.headers);
  for (const cookie of result.cookies || []) {
    headers.append('set-cookie', cookie);
  }

  const body = request.method === 'HEAD' || [204, 205, 304].includes(result.statusCode)
    ? null
    : result.isBase64Encoded
      ? Buffer.from(result.body, 'base64')
      : result.body;

  return new Response(body, { status: result.statusCode, headers });
};

export const config: Config = {
  path: '/*',
  preferStatic: true
};
