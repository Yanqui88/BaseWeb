import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: { name: "Default Store" },
    create: { slug: "default", name: "Default Store" },
  });

  await prisma.homeBanner.deleteMany({ where: { tenantId: tenant.id } });

  await prisma.homeBanner.create({
    data: {
      tenantId: tenant.id,
      desktopImageUrl: "https://picsum.photos/seed/proyectoweb-desktop/1600/500",
      mobileImageUrl: "https://picsum.photos/seed/proyectoweb-mobile/900/1200",
      href: "/ofertas",
      alt: "Promo destacada",
      badge: "3 cuotas sin interés",
      title: "Nueva colección",
      subtitle: "Envíos a todo el país",
      buttonText: "Ver ofertas",
      isActive: true,
      sortOrder: 0,
    },
  });

  console.log("Seed OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });