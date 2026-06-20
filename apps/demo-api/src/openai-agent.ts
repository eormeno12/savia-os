import OpenAI from "openai";
import { getMcpToolsForResponses, callMcpTool } from "./mcp-client.js";

type ChatMsg = { role: "user" | "assistant"; content: string };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = "gpt-5.4-nano";
const REASONING: "low" = "low";

export type StreamEvent =
  | { type: "plain_delta"; delta: string }
  | { type: "plain_done" }
  | { type: "memory_tool_start"; name: string }
  | { type: "memory_tool_done"; name: string }
  | { type: "memory_delta"; delta: string }
  | { type: "memory_done"; toolCallsMade: string[] }
  | { type: "done"; toolCallsMade: string[] };

// ── Helpers ──────────────────────────────────────────────────────────────────

function toResponsesInput(history: ChatMsg[], message: string) {
  return [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: message },
  ];
}

// ── Plain chat (no tools, completions API) ───────────────────────────────────

export async function chatPlain(history: ChatMsg[], message: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    // reasoning_effort not in SDK types yet for Responses API
    messages: [...history, { role: "user", content: message }],
  });
  return res.choices[0].message.content ?? "";
}

export async function* chatPlainStream(
  history: ChatMsg[],
  message: string
): AsyncGenerator<StreamEvent> {
  const stream = await openai.chat.completions.create({
    model: MODEL,
    // reasoning_effort not in SDK types yet for Responses API
    messages: [...history, { role: "user", content: message }],
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield { type: "plain_delta", delta };
  }

  yield { type: "plain_done" };
}

// ── Memory chat (with tools, Responses API) ──────────────────────────────────

export async function chatWithMemory(
  history: ChatMsg[],
  message: string,
  userId: string
): Promise<{ answer: string; toolCallsMade: string[] }> {
  const tools = await getMcpToolsForResponses(userId);
  const toolCallsMade: string[] = [];

  let response = await openai.responses.create({
    model: MODEL,
    // reasoning_effort not in SDK types yet for Responses API
    instructions: `Tienes memoria persistente vía herramientas. Antes de responder busca memorias relevantes (user_id="${userId}"). Después de responder guarda la información importante del usuario (user_id="${userId}").`,
    input: toResponsesInput(history, message),
    tools,
  });

  // Tool-call loop using previous_response_id for chaining
  while (true) {
    const functionCalls = (response.output as any[]).filter(
      (o: any) => o.type === "function_call"
    );
    if (functionCalls.length === 0) break;

    const toolOutputs = await Promise.all(
      functionCalls.map(async (fc: any) => {
        toolCallsMade.push(fc.name);
        const result = await callMcpTool(userId, fc.name, JSON.parse(fc.arguments || "{}"));
        return { type: "function_call_output" as const, call_id: fc.call_id, output: result };
      })
    );

    response = await openai.responses.create({
      model: MODEL,
      // reasoning_effort not in SDK types yet for Responses API
      previous_response_id: response.id,
      input: toolOutputs as any,
      tools,
    });
  }

  const textItem = (response.output as any[]).find((o: any) => o.type === "message");
  const answer = textItem?.content
    ?.filter((c: any) => c.type === "output_text")
    ?.map((c: any) => c.text)
    ?.join("") ?? "";

  return { answer, toolCallsMade };
}

export async function* chatWithMemoryStream(
  history: ChatMsg[],
  message: string,
  userId: string
): AsyncGenerator<StreamEvent> {
  const tools = await getMcpToolsForResponses(userId);
  const toolCallsMade: string[] = [];

  const instructions = `Tienes memoria persistente vía herramientas. Antes de responder busca memorias relevantes (user_id="${userId}"). Después de responder guarda la información importante del usuario (user_id="${userId}"). Responde en el mismo idioma que el usuario.`;

  let requestInput: any = toResponsesInput(history, message);
  let previousResponseId: string | undefined;

  while (true) {
    // Collect any function calls from this round
    const roundCalls: Array<{ name: string; callId: string; args: string }> = [];

    const stream = await openai.responses.create({
      model: MODEL,
      // reasoning_effort not in SDK types yet for Responses API
      instructions: previousResponseId ? undefined : instructions,
      ...(previousResponseId
        ? { previous_response_id: previousResponseId }
        : {}),
      input: requestInput,
      tools,
      stream: true,
    });

    for await (const event of stream as any) {
      switch (event.type) {
        case "response.output_text.delta":
          yield { type: "memory_delta", delta: event.delta };
          break;

        case "response.output_item.added":
          if (event.item?.type === "function_call") {
            yield { type: "memory_tool_start", name: event.item.name };
            roundCalls.push({ name: event.item.name, callId: event.item.call_id, args: "" });
          }
          break;

        case "response.function_call_arguments.delta": {
          const last = roundCalls.at(-1);
          if (last) last.args += event.delta;
          break;
        }

        case "response.output_item.done":
          if (event.item?.type === "function_call") {
            // args are fully accumulated on the item itself
            const last = roundCalls.at(-1);
            if (last && event.item.arguments) last.args = event.item.arguments;
          }
          break;

        case "response.completed":
          previousResponseId = event.response?.id;
          break;
      }
    }

    if (roundCalls.length === 0) break;

    // Execute tool calls and feed results back
    const toolOutputs: any[] = [];
    for (const fc of roundCalls) {
      toolCallsMade.push(fc.name);
      const result = await callMcpTool(userId, fc.name, JSON.parse(fc.args || "{}"));
      yield { type: "memory_tool_done", name: fc.name };
      toolOutputs.push({ type: "function_call_output", call_id: fc.callId, output: result });
    }

    requestInput = toolOutputs;
  }

  yield { type: "memory_done", toolCallsMade };
}
