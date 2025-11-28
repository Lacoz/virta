import { describe, expect, test, vi, beforeEach } from "vitest";
import {
  loadExpression,
  loadExpressionFromFile,
  loadExpressionFromUrl,
} from "../src/loadExpression.js";
import * as fs from "node:fs/promises";

// Mock fetch for URL tests
global.fetch = vi.fn();

describe("loadExpressionFromFile", () => {
  test("loads expression from local file", async () => {
    const filePath = "./test/fixtures/simple.jsonata";
    const content = '{"name": source.name}';

    // Use actual file for this test
    const expression = await loadExpressionFromFile(filePath);
    expect(expression).toBe(content);
  });

  test("throws error if file does not exist", async () => {
    const filePath = "./nonexistent.jsonata";

    await expect(loadExpressionFromFile(filePath)).rejects.toThrow(
      `Failed to load JSONata expression from file "${filePath}"`
    );
  });

  test("trims whitespace from file content", async () => {
    const filePath = "./test/fixtures/simple.jsonata";
    // File already exists, just test trimming
    const expression = await loadExpressionFromFile(filePath);
    expect(expression.trim()).toBe(expression);
  });
});

describe("loadExpressionFromUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("loads expression from HTTP URL", async () => {
    const url = "http://example.com/transform.jsonata";
    const content = '{"total": $sum(source.items.price)}';

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => content,
    });

    const expression = await loadExpressionFromUrl(url);
    expect(expression).toBe(content);
    expect(global.fetch).toHaveBeenCalledWith(url, expect.objectContaining({
      headers: expect.objectContaining({
        "Accept": "text/plain, application/json",
      }),
    }));
  });

  test("loads expression from HTTPS URL", async () => {
    const url = "https://example.com/transform.jsonata";
    const content = '{"name": source.name}';

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => content,
    });

    const expression = await loadExpressionFromUrl(url);
    expect(expression).toBe(content);
  });

  test("passes custom fetch options", async () => {
    const url = "https://example.com/transform.jsonata";
    const content = '{"name": source.name}';

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => content,
    });

    await loadExpressionFromUrl(url, {
      headers: { "Authorization": "Bearer token" },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        headers: expect.objectContaining({
          "Authorization": "Bearer token",
        }),
      })
    );
  });

  test("throws error on non-200 status", async () => {
    const url = "https://example.com/transform.jsonata";

    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
    });

    await expect(loadExpressionFromUrl(url)).rejects.toThrow(
      `Failed to fetch JSONata expression from URL`
    );
  });

  test("trims whitespace from URL content", async () => {
    const url = "https://example.com/transform.jsonata";
    const content = '  {"name": source.name}  \n';

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => content,
    });

    const expression = await loadExpressionFromUrl(url);
    expect(expression).toBe('{"name": source.name}');
  });
});

describe("loadExpression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("loads from URL when path starts with http://", async () => {
    const url = "http://example.com/transform.jsonata";
    const content = '{"name": source.name}';

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => content,
    });

    const expression = await loadExpression(url);
    expect(expression).toBe(content);
    expect(global.fetch).toHaveBeenCalled();
  });

  test("loads from URL when path starts with https://", async () => {
    const url = "https://example.com/transform.jsonata";
    const content = '{"name": source.name}';

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => content,
    });

    const expression = await loadExpression(url);
    expect(expression).toBe(content);
  });

  test("loads from file when path is not a URL", async () => {
    const filePath = "./test/fixtures/simple.jsonata";
    const content = '{"name": source.name}';

    const expression = await loadExpression(filePath);
    expect(expression).toBe(content);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

