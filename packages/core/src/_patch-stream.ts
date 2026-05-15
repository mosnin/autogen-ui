/**
 * Incremental parser for a tool input shaped like `{ message: string, patches: object[] }`.
 *
 * Feed it `partial_json` deltas from the model's tool-use stream; it emits
 * complete top-level objects from the `patches` array and unescaped text
 * deltas from the `message` string as they arrive. The parser is a small
 * state machine — no JSON.parse on partial input.
 */

export interface PatchStreamYield {
  /** Complete patch objects (raw strings, ready for JSON.parse). */
  patches: string[];
  /** Newly-arrived characters of the `message` string, with escapes resolved. */
  messageDelta: string;
}

interface State {
  buffer: string;
  patchScanPos: number;
  patchesArrayStart: number; // -1 until found; index right after the `[`
  arrayClosed: boolean;
  inString: boolean;
  escaped: boolean;
  braceDepth: number;
  currentPatchStart: number;
  messageScanPos: number;
  messageStringStart: number; // -1 until found; index right after the opening `"`
  messageDone: boolean;
  messageEscaped: boolean;
}

export function createPatchStreamParser() {
  const state: State = {
    buffer: "",
    patchScanPos: 0,
    patchesArrayStart: -1,
    arrayClosed: false,
    inString: false,
    escaped: false,
    braceDepth: 0,
    currentPatchStart: -1,
    messageScanPos: 0,
    messageStringStart: -1,
    messageDone: false,
    messageEscaped: false,
  };

  const FIND_PATCHES = /"patches"\s*:\s*\[/;
  const FIND_MESSAGE = /"message"\s*:\s*"/;

  return {
    feed(chunk: string): PatchStreamYield {
      state.buffer += chunk;
      const patches: string[] = [];
      let messageDelta = "";

      // Locate the `message` string body
      if (state.messageStringStart === -1 && !state.messageDone) {
        const m = FIND_MESSAGE.exec(state.buffer);
        if (m) {
          state.messageStringStart = m.index + m[0].length;
          state.messageScanPos = state.messageStringStart;
        }
      }

      // Stream message characters, unescaping as we go
      if (state.messageStringStart !== -1 && !state.messageDone) {
        let pos = state.messageScanPos;
        const b = state.buffer;
        while (pos < b.length) {
          const c = b[pos]!;
          if (state.messageEscaped) {
            if (c === "n") messageDelta += "\n";
            else if (c === "t") messageDelta += "\t";
            else if (c === "r") messageDelta += "\r";
            else if (c === "b") messageDelta += "\b";
            else if (c === "f") messageDelta += "\f";
            else if (c === '"') messageDelta += '"';
            else if (c === "\\") messageDelta += "\\";
            else if (c === "/") messageDelta += "/";
            else if (c === "u") {
              if (pos + 4 >= b.length) break; // wait for full \uXXXX
              const hex = b.slice(pos + 1, pos + 5);
              messageDelta += String.fromCharCode(parseInt(hex, 16));
              pos += 4;
            } else {
              messageDelta += c;
            }
            state.messageEscaped = false;
            pos++;
            continue;
          }
          if (c === "\\") {
            state.messageEscaped = true;
            pos++;
            continue;
          }
          if (c === '"') {
            state.messageDone = true;
            pos++;
            break;
          }
          messageDelta += c;
          pos++;
        }
        state.messageScanPos = pos;
      }

      // Locate the `patches` array body
      if (state.patchesArrayStart === -1) {
        const m = FIND_PATCHES.exec(state.buffer);
        if (m) {
          state.patchesArrayStart = m.index + m[0].length;
          state.patchScanPos = state.patchesArrayStart;
        }
      }

      // Walk the patches array, capturing complete top-level objects
      if (state.patchesArrayStart !== -1 && !state.arrayClosed) {
        let pos = state.patchScanPos;
        const b = state.buffer;
        while (pos < b.length) {
          const c = b[pos]!;
          if (state.inString) {
            if (state.escaped) state.escaped = false;
            else if (c === "\\") state.escaped = true;
            else if (c === '"') state.inString = false;
          } else if (c === '"') {
            state.inString = true;
          } else if (c === "{") {
            if (state.braceDepth === 0) state.currentPatchStart = pos;
            state.braceDepth++;
          } else if (c === "}") {
            state.braceDepth--;
            if (state.braceDepth === 0 && state.currentPatchStart !== -1) {
              patches.push(b.slice(state.currentPatchStart, pos + 1));
              state.currentPatchStart = -1;
            }
          } else if (c === "]" && state.braceDepth === 0) {
            state.arrayClosed = true;
            pos++;
            break;
          }
          pos++;
        }
        state.patchScanPos = pos;
      }

      return { patches, messageDelta };
    },
  };
}
