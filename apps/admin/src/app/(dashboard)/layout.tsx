import { cookies } from "next/headers";
import AdminShell from "@/components/AdminShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  let tenantName = "Acme Corporation";
  let tenantDomain = "";
  let tenantSlug = "demo";
  let userName = "John Doe";
  let userEmail = "admin@acme.com";

  if (token) {
    try {
      const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
      const res = await fetch(`${apiUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.tenant) {
          tenantName = data.tenant.name || tenantName;
          tenantDomain = data.tenant.domain || "";
          tenantSlug = data.tenant.slug || tenantSlug;
        }
        if (data?.email) {
          userEmail = data.email;
          // Si no hay name, usamos la primera parte del email
          userName = data.name || data.email.split('@')[0];
        }
      }
    } catch (err) {
      console.error("Error obteniendo /auth/me en DashboardLayout:", err);
    }
  }

  return (
    <AdminShell 
      tenantName={tenantName} 
      tenantDomain={tenantDomain} 
      tenantSlug={tenantSlug}
      userName={userName}
      userEmail={userEmail}
    >
      {children}
    </AdminShell>
  );
}

