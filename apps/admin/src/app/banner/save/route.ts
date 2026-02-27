import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const form = await req.formData();

  const payload = {
    desktopImageUrl: String(form.get("desktopImageUrl") ?? ""),
    mobileImageUrl: String(form.get("mobileImageUrl") ?? ""),
    href: String(form.get("href") ?? "") || null,
    alt: String(form.get("alt") ?? "") || null,
    badge: String(form.get("badge") ?? "") || null,
    title: String(form.get("title") ?? "") || null,
    subtitle: String(form.get("subtitle") ?? "") || null,
    buttonText: String(form.get("buttonText") ?? "") || null,
    isActive: true,
  };

  if (!payload.desktopImageUrl || !payload.mobileImageUrl) {
    return NextResponse.json(
      { error: "desktopImageUrl y mobileImageUrl son obligatorios" },
      { status: 400 }
    );
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const tenant = process.env.NEXT_PUBLIC_TENANT_SLUG!;

  const apiRes = await fetch(`${apiUrl}/admin/${tenant}/home/banner`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!apiRes.ok) {
    const text = await apiRes.text();
    return NextResponse.json({ error: text }, { status: 500 });
  }

  return NextResponse.redirect(new URL("/banner", req.url));
}