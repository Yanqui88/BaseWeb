import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function seedEcommerce(tenantId: string) {
  // Limpieza (solo para seed repetible en dev)
  await prisma.stock.deleteMany({ where: { tenantId } });
  await prisma.variant.deleteMany({ where: { tenantId } });
  await prisma.product.deleteMany({ where: { tenantId } });

  await prisma.product.create({
    data: {
      tenantId,
      title: "Remera Básica",
      slug: "remera-basica",
      status: "ACTIVE",
      coverImage: "https://picsum.photos/seed/remera/1200/1200",
      variants: {
        create: [
          {
            tenantId,
            sku: "REM-BAS-NEG-S",
            title: "Negro / S",
            price: 129900,
            color: "Negro",
            size: "S",
            stock: { create: { tenantId, quantity: 10 } },
          },
          {
            tenantId,
            sku: "REM-BAS-NEG-M",
            title: "Negro / M",
            price: 129900,
            color: "Negro",
            size: "M",
            stock: { create: { tenantId, quantity: 7 } },
          },
        ],
      },
    },
  });
}


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
  
  await seedEcommerce(tenant.id);

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