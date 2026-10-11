export function createTranscriptState() {
  return { lines: [], partialUser: "", partialModel: "" };
}

export function reduceTranscript(state, message) {
  const next = {
    lines: state.lines.slice(),
    partialUser: state.partialUser,
    partialModel: state.partialModel,
  };
  const server = message?.serverContent;
  if (!server) return next;

  if (typeof server.interimInputTranscription?.text === "string") {
    next.partialUser = server.interimInputTranscription.text;
  }
  if (typeof server.inputTranscription?.text === "string") {
    next.partialUser = mergeText(next.partialUser, server.inputTranscription.text);
  }
  if (typeof server.outputTranscription?.text === "string") {
    next.partialModel = mergeText(next.partialModel, server.outputTranscription.text);
  }
  const parts = server.modelTurn?.parts || [];
  for (const part of parts) {
    if (typeof part.text === "string" && part.text.trim()) {
      next.partialModel = mergeText(next.partialModel, part.text);
    }
  }
  if (server.interrupted || server.turnComplete) commitPartials(next);
  return next;
}

export function snapshotLines(state) {
  const lines = state.lines.slice();
  if (state.partialUser.trim()) lines.push({ role: "user", text: state.partialUser.trim() });
  if (state.partialModel.trim()) lines.push({ role: "model", text: state.partialModel.trim() });
  return lines;
}

function commitPartials(state) {
  const user = state.partialUser.trim();
  const model = state.partialModel.trim();
  if (user) state.lines.push({ role: "user", text: user });
  if (model) state.lines.push({ role: "model", text: model });
  state.partialUser = "";
  state.partialModel = "";
}

export function mergeText(prev, next) {
  if (!next) return prev || "";
  const incoming = String(next);
  if (!prev) return incoming;
  if (incoming === prev || prev.startsWith(incoming)) return prev;
  if (incoming.startsWith(prev)) return incoming;
  const joiner = /\s$/.test(prev) || /^\s/.test(incoming) ? "" : " ";
  return `${prev}${joiner}${incoming}`;
}
