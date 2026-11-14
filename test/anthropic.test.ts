import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { anthropicModel } from "../src/anthropic.js";

const fake = (content: unknown[]) =>
  ({ messages: { create: async () => ({ content, usage: { input_tokens: 10, output_tokens: 2 } }) } }) as unknown as Pick<Anthropic, "messages">;
const input = { goal: "g", step: 1, url: "http://x", screenshotPng: Buffer.from("png"), elements: [{ tag: "a", label: "Start", x: 10, y: 20 }], history: [] };

describe("anthropicModel", () => {
  it("parses the tool call and usage", async () => {
    const m = anthropicModel({
      client: fake([{ type: "tool_use", id: "1", name: "act", input: { expectation: "e", observation: "o", action: { type: "click", target: "#a" } } }]),
    });
    expect(await m.decide(input)).toEqual({ expectation: "e", observation: "o", action: { type: "click", target: "#a" }, usage: { in: 10, out: 2 } });
  });
  it("rejects an invalid action by name", async () => {
    const m = anthropicModel({ client: fake([{ type: "tool_use", id: "1", name: "act", input: { expectation: "e", observation: "o", action: { type: "fly" } } }]) });
    await expect(m.decide(input)).rejects.toThrow(/invalid action/);
  });
  it("rejects a reply with no tool call", async () => {
    await expect(anthropicModel({ client: fake([{ type: "text", text: "hi" }]) }).decide(input)).rejects.toThrow(/no tool call/);
  });
});

describe("anthropicModel prompt", () => {
  it("lists visible controls with coordinates so a screenshot model can address them", async () => {
    let text = "";
    const client = { messages: { create: async (r: any) => { text = r.messages[0].content[1].text; return { content: [{ type: "tool_use", id: "1", name: "act", input: { expectation: "e", observation: "o", action: { type: "stop" } } }], usage: { input_tokens: 1, output_tokens: 1 } }; } } } as unknown as Pick<Anthropic, "messages">;
    await anthropicModel({ client }).decide(input);
    expect(text).toContain('a "Start" at 10,20');
  });
});
