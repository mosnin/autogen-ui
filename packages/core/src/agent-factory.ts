import {
  createUIAgent,
  type CapabilityModule,
  type CreateUIAgentOptions,
  type TurnInfo,
  type UIAgent,
} from "./agent";
import type { BrandKit } from "./brand";
import type { LLMClient } from "./llm";
import type { ComponentDoc } from "./registry";

/**
 * Build agents on demand, per request, with stable caching by config hash.
 *
 * Use this when the host needs to vary `components`, `brand`, `prefer`,
 * or `instructions` per user/session/role — e.g. a team-admin sees more
 * components than a viewer, or a multi-tenant app swaps brand kits per
 * organization.
 *
 *   const factory = createAgentFactory({ client, capabilities });
 *   export const POST = createRouteHandler({
 *     agent: factory.get({
 *       components: getComponentsForRole(req.user.role),
 *       brand: getBrandForTenant(req.user.tenant),
 *     }),
 *   });
 *
 * Configs hash to a stable key; identical inputs return the same memoized
 * agent (so the system prompt cache holds). LRU-evicted past `maxCached`.
 */

export interface AgentFactoryOptions {
  client: LLMClient;
  capabilities?: CapabilityModule[];
  /** Components every agent sees regardless of per-request additions. */
  baseComponents?: ComponentDoc[];
  /** Prefer list every agent sees. */
  basePrefer?: string[];
  /** Default brand for agents that don't specify one per-request. */
  baseBrand?: BrandKit;
  /** Default instructions, joined with per-request instructions. */
  baseInstructions?: string;
  /** Strict component mode for every agent. */
  strict?: boolean;
  /** Bounded auto-repair attempts. */
  maxRepairAttempts?: number;
  /** Repair on hallucinated-id warnings. */
  repairOnWarnings?: boolean;
  /** Telemetry — fires for every turn from every agent in the factory. */
  onTurn?: (info: TurnInfo) => void;
  /** Max cached agents. Default 32. */
  maxCached?: number;
}

export interface AgentBuildOptions {
  components?: ComponentDoc[];
  prefer?: string[];
  brand?: BrandKit;
  instructions?: string;
}

/** Deterministic JSON-based hash. Recursively sorts object keys. */
function stableKey(value: unknown): string {
  const seen = new WeakSet<object>();
  const norm = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v as object)) return null;
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(norm);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = norm((v as Record<string, unknown>)[k]);
    }
    return out;
  };
  return JSON.stringify(norm(value));
}

export interface AgentFactory {
  /** Get (or build + cache) an agent matching the request. */
  get(req?: AgentBuildOptions): UIAgent;
  /** Drop everything from the cache. */
  clear(): void;
  /** Current cache size. */
  size(): number;
}

export function createAgentFactory(opts: AgentFactoryOptions): AgentFactory {
  const cache = new Map<string, UIAgent>();
  const max = opts.maxCached ?? 32;

  function build(req: AgentBuildOptions): UIAgent {
    const components = [...(opts.baseComponents ?? []), ...(req.components ?? [])];
    const prefer = [...(opts.basePrefer ?? []), ...(req.prefer ?? [])];
    const instructionParts = [opts.baseInstructions, req.instructions].filter(
      (s): s is string => typeof s === "string" && s.length > 0,
    );
    const instructions = instructionParts.length > 0 ? instructionParts.join("\n\n") : undefined;
    const args: CreateUIAgentOptions = {
      client: opts.client,
      capabilities: opts.capabilities,
      components,
      prefer: prefer.length > 0 ? prefer : undefined,
      strict: opts.strict,
      brand: req.brand ?? opts.baseBrand,
      instructions,
      maxRepairAttempts: opts.maxRepairAttempts,
      repairOnWarnings: opts.repairOnWarnings,
      onTurn: opts.onTurn,
    };
    return createUIAgent(args);
  }

  return {
    get(req: AgentBuildOptions = {}): UIAgent {
      const key = stableKey({
        components: req.components ?? null,
        prefer: req.prefer ?? null,
        brand: req.brand ?? null,
        instructions: req.instructions ?? null,
      });
      const cached = cache.get(key);
      if (cached) {
        // Refresh LRU position.
        cache.delete(key);
        cache.set(key, cached);
        return cached;
      }
      const agent = build(req);
      cache.set(key, agent);
      if (cache.size > max) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      return agent;
    },
    clear() {
      cache.clear();
    },
    size() {
      return cache.size;
    },
  };
}
