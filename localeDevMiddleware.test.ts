import { describe, it, expect, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import localeDevMiddleware from "./localeDevMiddleware";

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void;

async function setup(): Promise<Handler> {
  let handler!: Handler;
  const server = {
    middlewares: { use: (fn: Handler) => (handler = fn) },
  } as unknown as ViteDevServer;

  const integration = localeDevMiddleware();
  // @ts-expect-error -- test-only narrowing of the astro:server:setup hook signature
  await integration.hooks["astro:server:setup"]({ server });

  return handler;
}

function fakeRes() {
  return {
    statusCode: 200,
    setHeader: vi.fn(),
    end: vi.fn(),
  };
}

describe("localeDevMiddleware", () => {
  it("calls next() and leaves the response untouched when middleware.ts has nothing to redirect", async () => {
    const handler = await setup();
    const req = { url: "/", headers: { host: "localhost:4321" } };
    const res = fakeRes();
    const next = vi.fn();

    handler(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(res.end).not.toHaveBeenCalled();
  });

  it("writes the redirect status and headers from middleware.ts", async () => {
    const handler = await setup();
    const req = {
      url: "/",
      headers: { host: "localhost:4321", "accept-language": "en" },
    };
    const res = fakeRes();
    const next = vi.fn();

    handler(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(302);
    expect(res.setHeader).toHaveBeenCalledWith(
      "location",
      "http://localhost:4321/en/",
    );
    expect(res.end).toHaveBeenCalledOnce();
  });

  it("joins multi-value request headers before constructing the Request", async () => {
    const handler = await setup();
    const req = {
      url: "/",
      headers: { host: "localhost:4321", "accept-language": ["en", "ru"] },
    };
    const res = fakeRes();
    const next = vi.fn();

    handler(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      next,
    );

    expect(res.setHeader).toHaveBeenCalledWith(
      "location",
      "http://localhost:4321/en/",
    );
  });
});
