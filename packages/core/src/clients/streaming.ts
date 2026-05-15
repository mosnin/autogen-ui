/**
 * Backwards-compat shim. Streaming is now built into the unified clients in
 * `./index`; this file just re-exports under the old "Stream" names.
 */
export {
  createAnthropicStreamClient,
  createOpenAIStreamClient,
  type AnthropicStreamClientOptions,
  type OpenAIStreamClientOptions,
} from "./index";
