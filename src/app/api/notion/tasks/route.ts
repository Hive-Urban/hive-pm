import { NextRequest, NextResponse } from "next/server";
import { fetchNotionTasks } from "@/lib/notion";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const product = searchParams.get("product") ?? undefined;
    const sprint = searchParams.get("sprint") ?? undefined;
    const status = searchParams.get("status") ?? undefined;

    const tasks = await fetchNotionTasks({ product, sprint, status });

    // If product filter provided, try to filter client-side too (Notion doesn't always support it directly)
    const filtered = product
      ? tasks.filter((t) =>
          t.product?.toLowerCase().includes(product.toLowerCase()) ||
          t.name?.toLowerCase().includes(product.toLowerCase())
        )
      : tasks;

    return NextResponse.json({ tasks: filtered });
  } catch (err: any) {
    console.error("Notion API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
