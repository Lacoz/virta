import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * Loads a JSONata expression from a local file.
 * 
 * @param filePath - Path to the file containing the JSONata expression
 * @returns The expression as a string
 * @throws Error if the file cannot be read
 * 
 * @example
 * ```ts
 * const expression = await loadExpressionFromFile("./expressions/transform.jsonata");
 * ```
 */
export async function loadExpressionFromFile(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath, "utf-8");
    return content.trim();
  } catch (error) {
    throw new Error(
      `Failed to load JSONata expression from file "${filePath}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Loads a JSONata expression from a URL (HTTP/HTTPS).
 * 
 * @param url - URL to fetch the JSONata expression from
 * @param options - Optional fetch options (headers, timeout, etc.)
 * @returns The expression as a string
 * @throws Error if the URL cannot be fetched or returns non-200 status
 * 
 * @example
 * ```ts
 * const expression = await loadExpressionFromUrl("https://example.com/transform.jsonata");
 * ```
 */
export async function loadExpressionFromUrl(
  url: string,
  options?: RequestInit
): Promise<string> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Accept": "text/plain, application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch JSONata expression from URL "${url}": ${response.status} ${response.statusText}`
      );
    }

    const content = await response.text();
    return content.trim();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Failed to fetch")) {
      throw new Error(
        `Failed to fetch JSONata expression from URL "${url}": Network error`
      );
    }
    throw error;
  }
}

/**
 * Loads a JSONata expression from a file path or URL.
 * Automatically detects if the path is a URL (starts with http:// or https://)
 * or a local file path.
 * 
 * @param pathOrUrl - File path or URL to load the expression from
 * @param options - Optional fetch options for URLs
 * @returns The expression as a string
 * 
 * @example
 * ```ts
 * // Load from file
 * const expr1 = await loadExpression("./transform.jsonata");
 * 
 * // Load from URL
 * const expr2 = await loadExpression("https://example.com/transform.jsonata");
 * ```
 */
export async function loadExpression(
  pathOrUrl: string,
  options?: RequestInit
): Promise<string> {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return loadExpressionFromUrl(pathOrUrl, options);
  } else {
    return loadExpressionFromFile(pathOrUrl);
  }
}

