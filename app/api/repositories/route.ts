import { NextResponse } from "next/server";
import { jsonSafe } from "@/lib/json";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const repositories = await prisma.repository.findMany({
    orderBy: { lastSyncedAt: "desc" },
    take: 20,
    include: { _count: { select: { issues: true } } },
  });

  return NextResponse.json(jsonSafe({ repositories }));
}

export async function DELETE(request: Request) {
  const { repositoryId } = await request.json().catch(() => ({ repositoryId: "" }));
  if (!repositoryId || typeof repositoryId !== "string") {
    return NextResponse.json({ error: "Repository id is required." }, { status: 400 });
  }

  await prisma.repository.delete({ where: { id: repositoryId } });
  return NextResponse.json({ ok: true });
}
