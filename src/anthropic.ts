import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ComputerUseModel, StepDecision, StepInput } from "./model.js";
import { Action } from "./schema.js";

const Decision = z.object({
  expectation: z.string(),
  observation: z.string(),
  action: Action,
});

const TOOL = {
  name: "act",
  description:
    "Record what you expect, what you see, and the single next browser action. Use action.type 'stop' when the task goal is reached or you give up, with the reason in action.value. Never submit a form: use 'submit' to say you would, and the run will stop.",
  input_schema: {
    type: "object" as const,
    properties: {
      expectation: { type: "string", description: "What you expect the next action to do." },
      observation: { type: "string", description: "What you see on the page now, as the persona would read it." },
      action: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["click", "type", "select", "back", "scroll", "submit", "stop"] },
          target: { type: "string", description: "CSS selector, or 'x,y' viewport coordinates for a click." },
          value: { type: "string" },
        },
        required: ["type"],
      },
    },
    required: ["expectation", "observation", "action"],
  },
};

export interface AnthropicModelOptions {
  client: Pick<Anthropic, "messages">;
  model?: string;
  /** Persona instructions belong to C2; the runner only passes them through. */
  systemPrompt?: string;
  maxTokens?: number;
}

export function anthropicModel(opts: AnthropicModelOptions): ComputerUseModel {
  return {
    async decide(input: StepInput): Promise<StepDecision> {
      const recent = input.history
        .slice(-5)
        .map((e) => `step ${e.step}: expected "${e.expectation}", did ${JSON.stringify(e.action)}`)
        .join("\n");
      const res = await opts.client.messages.create({
        model: opts.model ?? "claude-sonnet-5-5",
        max_tokens: opts.maxTokens ?? 1024,
        ...(opts.systemPrompt ? { system: opts.systemPrompt } : {}),
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/png", data: input.screenshotPng.toString("base64") } },
              { type: "text", text: `Task: ${input.goal}\nStep ${input.step}. Page: ${input.url}\n${recent ? `Recent steps:\n${recent}` : "No steps yet."}` },
            ],
          },
        ],
      });
      const use = res.content.find((b) => b.type === "tool_use");
      if (!use || use.type !== "tool_use") throw new Error("model returned no tool call");
      const parsed = Decision.safeParse(use.input);
      if (!parsed.success) throw new Error(`model returned an invalid action: ${parsed.error.message}`);
      return { ...parsed.data, usage: { in: res.usage.input_tokens, out: res.usage.output_tokens } };
    },
  };
}
