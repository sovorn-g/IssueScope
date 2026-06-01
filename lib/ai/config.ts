export type TextProvider = "openai" | "gemini" | "deepseek";
export type EmbeddingProvider = "openai" | "gemini" | "voyage";

export function aiConfig() {
  return {
    textProvider: (process.env.AI_TEXT_PROVIDER ?? "openai") as TextProvider,
    textModel: process.env.AI_TEXT_MODEL ?? "gpt-5.4-mini",
    embeddingProvider: (process.env.AI_EMBEDDING_PROVIDER ?? "openai") as EmbeddingProvider,
    embeddingModel: process.env.AI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    openaiKey: process.env.OPENAI_API_KEY,
    geminiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY,
    deepseekKey: process.env.DEEPSEEK_API_KEY,
    voyageKey: process.env.VOYAGE_API_KEY,
  };
}
