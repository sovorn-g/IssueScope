import { NextResponse } from "next/server";
import { parseGitHubRepoUrl } from "@/lib/github/parser";
import { safeErrorMessage } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const { repoUrl } = await request.json();
    return NextResponse.json(parseGitHubRepoUrl(String(repoUrl ?? "")));
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 });
  }
}
