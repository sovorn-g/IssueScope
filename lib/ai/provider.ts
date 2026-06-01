import { generateObject, generateText, embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { aiConfig } from "./config";
import { IssueForAi, normalizeIssueText } from "./normalize";

export const issueAnalysisSchema = z.object({
  analyses: z.array(z.object({
    issueId: z.string(),
    severity: z.enum(["critical", "high", "medium", "low"]),
    severityReason: z.string().min(1).max(240),
    missingRepro: z.boolean(),
    missingReproReason: z.string().min(1).max(240),
  })),
});

export type IssueAnalysisResult = z.infer<typeof issueAnalysisSchema>["analyses"][number];

function textModel() {
  const cfg = aiConfig();
  if (cfg.textProvider === "gemini") return createGoogleGenerativeAI({ apiKey: cfg.geminiKey })(cfg.textModel);
  if (cfg.textProvider === "deepseek") return createOpenAI({ apiKey: cfg.deepseekKey, baseURL: "https://api.deepseek.com" }).chat(cfg.textModel);
  return createOpenAI({ apiKey: cfg.openaiKey })(cfg.textModel);
}

function embeddingModel() {
  const cfg = aiConfig();
  if (cfg.embeddingProvider === "gemini") return createGoogleGenerativeAI({ apiKey: cfg.geminiKey }).textEmbeddingModel(cfg.embeddingModel);
  if (cfg.embeddingProvider === "openai") return createOpenAI({ apiKey: cfg.openaiKey }).embedding(cfg.embeddingModel);
  return null;
}

export async function analyzeIssues(issues: IssueForAi[]): Promise<IssueAnalysisResult[]> {
  const cfg = aiConfig();
  console.info("[ai] provider:analysis:request", { provider: cfg.textProvider, model: cfg.textModel, issueCount: issues.length });
  const startedAt = Date.now();
  const prompt = `Classify GitHub issues for maintainer triage. Severity meanings: critical=security/data loss/install/build/core workflow broken; high=important bug/regression with clear impact; medium=normal actionable bug/feature; low=question/docs/nice-to-have. missingRepro=true when steps, expected/actual behavior, environment, logs, or minimal reproduction are absent enough to block action. Return one analysis per issue.\n\n${issues.map((i) => `ISSUE_ID=${i.id}\n${normalizeIssueText(i)}`).join("\n\n---\n\n")}`;

  if (cfg.textProvider === "deepseek") {
    const { text } = await generateText({
      model: textModel(),
      prompt: `${prompt}\n\nReturn ONLY valid JSON with this shape, no markdown/code fences: {"analyses":[{"issueId":"...","severity":"critical|high|medium|low","severityReason":"short non-empty reason","missingRepro":true,"missingReproReason":"short non-empty reason; if missingRepro is false explain what context is sufficient"}]}`,
    });
    const parsed = JSON.parse(extractJson(text)) as { analyses?: Array<Partial<IssueAnalysisResult>> };
    if (Array.isArray(parsed.analyses)) {
      parsed.analyses = parsed.analyses.map((analysis) => ({
        ...analysis,
        severityReason: analysis.severityReason?.trim() || "Severity inferred from issue title, body, and labels.",
        missingReproReason: analysis.missingReproReason?.trim() || (analysis.missingRepro ? "Report appears to be missing enough reproduction details." : "Report includes sufficient reproduction/context details."),
      }));
    }
    const object = issueAnalysisSchema.parse(parsed);
    console.info("[ai] provider:analysis:response", { provider: cfg.textProvider, model: cfg.textModel, resultCount: object.analyses.length, durationMs: Date.now() - startedAt });
    return object.analyses;
  }

  const { object } = await generateObject({
    model: textModel(),
    schema: issueAnalysisSchema,
    prompt,
  });
  console.info("[ai] provider:analysis:response", { provider: cfg.textProvider, model: cfg.textModel, resultCount: object.analyses.length, durationMs: Date.now() - startedAt });
  return object.analyses;
}

export async function embedIssueTexts(values: string[]): Promise<number[][]> {
  const cfg = aiConfig();
  console.info("[ai] provider:embeddings:request", { provider: cfg.embeddingProvider, model: cfg.embeddingModel, inputCount: values.length });
  const startedAt = Date.now();
  if (cfg.embeddingProvider === "voyage") {
    const embeddings = await voyageEmbed(values, cfg.embeddingModel, cfg.voyageKey);
    console.info("[ai] provider:embeddings:response", { provider: cfg.embeddingProvider, model: cfg.embeddingModel, embeddingCount: embeddings.length, dimensions: embeddings[0]?.length ?? 0, durationMs: Date.now() - startedAt });
    return embeddings;
  }
  const model = embeddingModel();
  if (!model) throw new Error("Embedding provider is not configured.");
  const result = await embedMany({ model, values });
  console.info("[ai] provider:embeddings:response", { provider: cfg.embeddingProvider, model: cfg.embeddingModel, embeddingCount: result.embeddings.length, dimensions: result.embeddings[0]?.length ?? 0, durationMs: Date.now() - startedAt });
  return result.embeddings;
}

function extractJson(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error(`AI response did not contain JSON: ${trimmed.slice(0, 300)}`);
  return trimmed.slice(start, end + 1);
}

async function voyageEmbed(input: string[], model: string, apiKey?: string) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey ?? ""}` },
    body: JSON.stringify({ input, model }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Voyage embedding request failed with status ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = await res.json() as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}
