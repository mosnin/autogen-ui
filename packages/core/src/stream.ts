import { streamFrameSchema, type StreamFrame } from "./schema";

/**
 * NDJSON transport for StreamFrames. One JSON object per line; the client
 * splits on newlines and validates each frame. Used by the streaming agent
 * route handler and the streaming dashboard hook (Phase 2).
 */

/** Encode a single frame as one JSON line terminated by a newline. */
export function encodeFrame(frame: StreamFrame): string {
  return JSON.stringify(frame) + "\n";
}

/** Wrap an async iterable of frames in a streaming `application/x-ndjson` Response. */
export function framesToResponse(frames: AsyncIterable<StreamFrame>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for await (const frame of frames) {
          controller.enqueue(encoder.encode(encodeFrame(frame)));
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(
          encoder.encode(encodeFrame({ kind: "error", error: message })),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-cache, no-transform",
    },
  });
}

/**
 * Read a streaming NDJSON response, yielding validated StreamFrames. Handles
 * partial lines split across network chunks.
 */
export async function* readFrames(
  response: Response,
): AsyncIterable<StreamFrame> {
  const body = response.body;
  if (!body) throw new Error("[autogen-ui] response has no body to stream");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) yield streamFrameSchema.parse(JSON.parse(line));
        newlineIndex = buffer.indexOf("\n");
      }
    }
    const tail = buffer.trim();
    if (tail) yield streamFrameSchema.parse(JSON.parse(tail));
  } finally {
    reader.releaseLock();
  }
}
