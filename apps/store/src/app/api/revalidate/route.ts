import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret") || request.headers.get("x-revalidate-token");
  const expectedSecret = process.env.REVALIDATE_SECRET || "super-secret-revalidation-token-2026";

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tags } = body as { tags?: string[] };

    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json({ message: "Tags array is required" }, { status: 400 });
    }

    for (const tag of tags) {
      revalidateTag(tag, "max");
    }

    return NextResponse.json({ revalidated: true, tags, now: Date.now() });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
