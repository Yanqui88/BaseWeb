import "dotenv/config";
import { Client } from "pg";

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();
  console.log("Conectado a Postgres para realizar el Seed...");

  try {
    await client.query("BEGIN");

    // 1. Limpieza de datos en orden para respetar claves foráneas
    await client.query("DELETE FROM variant_option_values");
    await client.query("DELETE FROM inventories");
    await client.query("DELETE FROM locations");
    await client.query("DELETE FROM variants");
    await client.query("DELETE FROM product_option_values");
    await client.query("DELETE FROM product_options");
    await client.query("DELETE FROM products");
    await client.query("DELETE FROM home_banners");
    await client.query("DELETE FROM users");
    await client.query("DELETE FROM tenants");

    // 2. Crear Tenant 'default'
    const tenantId = "tenant-default-id";
    await client.query(
      "INSERT INTO tenants (id, slug, name) VALUES ($1, $2, $3)",
      [tenantId, "default", "Default Store"]
    );
    console.log("Tenant 'default' creado.");

    // 3. Crear Banner de prueba activo
    await client.query(
      `INSERT INTO home_banners (
        id, tenant_id, desktop_image_url, mobile_image_url, href, alt, badge, title, subtitle, button_text, is_active, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        "banner-1",
        tenantId,
        "https://picsum.photos/seed/proyectoweb-desktop/1600/500",
        "https://picsum.photos/seed/proyectoweb-mobile/900/1200",
        "/ofertas",
        "Promo destacada",
        "3 cuotas sin interés",
        "Nueva colección",
        "Envíos a todo el país",
        "Ver ofertas",
        true,
        0,
      ]
    );
    console.log("Banner de prueba creado.");

    // 4. Crear Sucursal física principal
    const locationId = "location-central-id";
    await client.query(
      "INSERT INTO locations (id, tenant_id, name, city, address) VALUES ($1, $2, $3, $4, $5)",
      [locationId, tenantId, "Sucursal Central", "Buenos Aires", "Av. Cabildo 1234"]
    );
    console.log("Sucursal Central creada.");

    // 5. Crear Producto: 'Remera Básica'
    const productId = "product-remera-id";
    await client.query(
      `INSERT INTO products (id, tenant_id, title, slug, status, cover_image, images) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        productId,
        tenantId,
        "Remera Básica",
        "remera-basica",
        "ACTIVE",
        "https://picsum.photos/seed/remera/1200/1200",
        ["https://picsum.photos/seed/remera/1200/1200"],
      ]
    );
    console.log("Producto 'Remera Básica' creado.");

    // 6. Crear Opciones (Color y Talle) para el Producto
    const optionColorId = "option-color-id";
    const optionTalleId = "option-talle-id";
    await client.query(
      "INSERT INTO product_options (id, tenant_id, product_id, name) VALUES ($1, $2, $3, $4)",
      [optionColorId, tenantId, productId, "Color"]
    );
    await client.query(
      "INSERT INTO product_options (id, tenant_id, product_id, name) VALUES ($1, $2, $3, $4)",
      [optionTalleId, tenantId, productId, "Talle"]
    );

    // 7. Crear Valores de las Opciones
    const valNegroId = "val-negro-id";
    const valSId = "val-s-id";
    const valMId = "val-m-id";
    await client.query(
      "INSERT INTO product_option_values (id, option_id, value) VALUES ($1, $2, $3)",
      [valNegroId, optionColorId, "Negro"]
    );
    await client.query(
      "INSERT INTO product_option_values (id, option_id, value) VALUES ($1, $2, $3)",
      [valSId, optionTalleId, "S"]
    );
    await client.query(
      "INSERT INTO product_option_values (id, option_id, value) VALUES ($1, $2, $3)",
      [valMId, optionTalleId, "M"]
    );
    console.log("Valores de opción creados (Negro, S, M).");

    // 8. Crear Variantes del Producto
    const variantSId = "variant-s-id";
    const variantMId = "variant-m-id";
    await client.query(
      `INSERT INTO variants (id, tenant_id, product_id, sku, title, price) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [variantSId, tenantId, productId, "REM-BAS-NEG-S", "Negro / S", 129900]
    );
    await client.query(
      `INSERT INTO variants (id, tenant_id, product_id, sku, title, price) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [variantMId, tenantId, productId, "REM-BAS-NEG-M", "Negro / M", 129900]
    );

    // 9. Vincular Variantes con sus respectivos Atributos
    // Negro / S
    await client.query(
      "INSERT INTO variant_option_values (variant_id, option_value_id) VALUES ($1, $2)",
      [variantSId, valNegroId]
    );
    await client.query(
      "INSERT INTO variant_option_values (variant_id, option_value_id) VALUES ($1, $2)",
      [variantSId, valSId]
    );
    // Negro / M
    await client.query(
      "INSERT INTO variant_option_values (variant_id, option_value_id) VALUES ($1, $2)",
      [variantMId, valNegroId]
    );
    await client.query(
      "INSERT INTO variant_option_values (variant_id, option_value_id) VALUES ($1, $2)",
      [variantMId, valMId]
    );
    console.log("Variantes mapeadas con sus atributos.");

    // 10. Registrar Stock de inventario en la Sucursal Central
    const invSId = "inv-s-id";
    const invMId = "inv-m-id";
    await client.query(
      `INSERT INTO inventories (id, tenant_id, variant_id, location_id, quantity) 
       VALUES ($1, $2, $3, $4, $5)`,
      [invSId, tenantId, variantSId, locationId, 10]
    );
    await client.query(
      `INSERT INTO inventories (id, tenant_id, variant_id, location_id, quantity) 
       VALUES ($1, $2, $3, $4, $5)`,
      [invMId, tenantId, variantMId, locationId, 7]
    );
    console.log("Inventario cargado en Sucursal Central (S: 10, M: 7).");

    await client.query("COMMIT");
    console.log("Seed de base de datos finalizado con éxito.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al ejecutar el seed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
