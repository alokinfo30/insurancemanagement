import type { Config, Context } from '@netlify/functions';
import serverless from 'serverless-http';

type ApplicationResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  cookies?: string[];
  body?: string;
  isBase64Encoded?: boolean;
};

export default async (request: Request, context: Context) => {
  try {
    const { default: app } = await import('../../server.js');
    const handler = serverless(app);
    const url = new URL(request.url);

    let reqBodyBuffer: Buffer = Buffer.alloc(0);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        reqBodyBuffer = Buffer.from(await request.arrayBuffer());
      } catch (e) {
        reqBodyBuffer = Buffer.alloc(0);
      }
    }

    const result = await handler({
      version: '2.0',
      rawPath: url.pathname,
      rawQueryString: url.search.slice(1),
      headers: Object.fromEntries(request.headers),
      body: reqBodyBuffer.toString('base64'),
      isBase64Encoded: true,
      requestContext: {
        requestId: context.requestId,
        http: {
          method: request.method,
          sourceIp: context.ip
        }
      }
    }, {}) as ApplicationResponse;

    const headers = new Headers();
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        if (value !== undefined && value !== null) {
          headers.set(key, String(value));
        }
      }
    }
    for (const cookie of result.cookies || []) {
      headers.append('set-cookie', cookie);
    }

    // Safely handle body for redirects and content
    let responseBody: BodyInit | null = null;
    const isRedirectOrEmpty = [204, 205, 301, 302, 303, 304, 307, 308].includes(result.statusCode);

    if (request.method !== 'HEAD' && !isRedirectOrEmpty) {
      if (result.isBase64Encoded && typeof result.body === 'string' && result.body.length > 0) {
        responseBody = Buffer.from(result.body, 'base64');
      } else if (typeof result.body === 'string') {
        responseBody = result.body;
      }
    }

    return new Response(responseBody, { status: result.statusCode || 200, headers });
  } catch (error: any) {
    console.error('Handled Netlify Function error:', error);
    return new Response(`Application Error: ${error?.message || error}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

export const config: Config = {
  path: '/*',
  preferStatic: true
};
