import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { toolResult } from '../types.js';

type ToolFn = (args: unknown) => Promise<ReturnType<typeof toolResult>>;

const REGISTRY = new Map<string, ToolFn>();
const DEFINITIONS: Tool[] = [];

export function register(def: Tool, fn: ToolFn): void {
  DEFINITIONS.push(def);
  REGISTRY.set(def.name, fn);
}

export function getToolDefinitions(): Tool[] {
  return DEFINITIONS;
}

export async function dispatch(
  name: string,
  args: unknown,
): Promise<ReturnType<typeof toolResult>> {
  const fn = REGISTRY.get(name);
  if (!fn) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return fn(args);
}
