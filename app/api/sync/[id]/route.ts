import { NextResponse } from "next/server";
import { jsonSafe } from "@/lib/json";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const syncRun = await prisma.syncRun.findUnique({ where: { id } });
  if (!syncRun) return NextResponse.json({ error: "Sync run not found." }, { status: 404 });
  return NextResponse.json(jsonSafe({ syncRun }));
}
