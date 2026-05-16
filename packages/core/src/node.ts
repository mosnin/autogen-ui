import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Node.js http adapter for the framework-agnostic Web `Request`/`Response`
 * handlers produced by `createRouteHandler` / `createStreamingRouteHandler` /
 * `createDataProxyHandler`.
 *
 *     import { createServer } from "node:http";
 *     import { createUIAgent, createRouteHandler } from "@autogen-ui/core/server";
 *     import { toNodeHandler } from "@autogen-ui/core/node";
 *
 *     const agent = createUIAgent({ client });
 *     createServer(toNodeHandler(createRouteHandler({ agent }))).listen(3000);
 *
 * Lives in its own subpath so consumers in non-Node runtimes (edge, browser)
 * don't accidentally pull in `node:http`.
 */

export type WebHandler = (request: Request) => Promise<Response> | Response;

export function toNodeHandler(handler: WebHandler) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const webReq = await nodeRequestToWeb(req);
      const webRes = await handler(webReq);
      await pipeWebResponseToNode(webRes, res);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json");
      }
      res.end(JSON.stringify({ error: message }));
    }
  };
}

async function nodeRequestToWeb(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const method = (req.method ?? "GET").toUpperCase();

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
    }
    if (chunks.length > 0) body = Buffer.concat(chunks);
  }

  return new Request(url, { method, headers, body });
}

async function pipeWebResponseToNode(
  webRes: Response,
  res: ServerResponse,
): Promise<void> {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => res.setHeader(key, value));

  if (!webRes.body) {
    res.end();
    return;
  }

  const reader = webRes.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        res.write(Buffer.from(value));
      }
    }
  } finally {
    reader.releaseLock();
    res.end();
  }
}
