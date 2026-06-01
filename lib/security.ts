export function redactToken(value: string) {
  return value.replace(/github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+/g, "[REDACTED_GITHUB_TOKEN]");
}

export function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return redactToken(message);
}
