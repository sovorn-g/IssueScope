export type ParsedRepo = { owner: string; name: string; fullName: string };

export function parseGitHubRepoUrl(input: string): ParsedRepo {
  const raw = input.trim();
  if (!raw) throw new Error("Repository URL is required.");

  const shorthand = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shorthand) return toRepo(shorthand[1], shorthand[2]);

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a GitHub URL like https://github.com/owner/repo.");
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new Error("Only github.com repository URLs are supported.");
  }

  const [owner, repo] = url.pathname.replace(/^\/+/, "").split("/");
  if (!owner || !repo) throw new Error("Enter a GitHub URL like https://github.com/owner/repo.");
  return toRepo(owner, repo.replace(/\.git$/, ""));
}

function toRepo(owner: string, name: string): ParsedRepo {
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) {
    throw new Error("Repository owner or name contains unsupported characters.");
  }
  return { owner, name, fullName: `${owner}/${name}` };
}
