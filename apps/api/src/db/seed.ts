import "dotenv/config";
import { Client } from "pg";
import { encrypt } from "../utils/crypto.util";

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();
  console.log("Conectado a Postgres para realizar el Seed...");

  try {
    await client.query("BEGIN");

    // 1. Limpieza de datos en orden para respetar claves foráneas
    await client.query("DELETE FROM tenant_mp_credentials");
    await client.query("DELETE FROM variant_option_values");
    await client.query("DELETE FROM inventory");
    await client.query("DELETE FROM locations");
    await client.query("DELETE FROM variants");
    await client.query("DELETE FROM product_option_values");
    await client.query("DELETE FROM product_options");
    await client.query("DELETE FROM products");
    await client.query("DELETE FROM home_banners");
    await client.query("DELETE FROM users");
    await client.query("DELETE FROM tenants");

    // 2. Crear Tenant 'default' con dominio 'localhost'
    const tenantId = "d3b07384-d113-4ec2-a5d6-c8402b89f816";
    await client.query(
      `INSERT INTO tenants (id, slug, name, domain, primary_color, secondary_color) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, "default", "Default Store", "localhost", "#3b82f6", "#1e3a8a"]
    );
    console.log("Tenant 'default' creado.");

    // 2.5 Crear credenciales MP mock para el Tenant
    const encryptedToken = encrypt("APP_USR-mock-token-12345");
    await client.query(
      `INSERT INTO tenant_mp_credentials (tenant_id, mp_user_id, access_token_encrypted, public_key) 
       VALUES ($1, $2, $3, $4)`,
      [tenantId, "mp-user-mock-1", encryptedToken, "APP_USR-mock-public-key-12345"]
    );
    console.log("Credenciales Mercado Pago mock creadas.");

    // 3. Crear Banner de prueba activo
    const bannerId = "d3b07384-d113-4ec2-a5d6-c8402b89f817";
    await client.query(
      `INSERT INTO home_banners (
        id, tenant_id, desktop_image_url, mobile_image_url, href, alt, badge, title, subtitle, button_text, is_active, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        bannerId,
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
    const locationId = "d3b07384-d113-4ec2-a5d6-c8402b89f818";
    await client.query(
      "INSERT INTO locations (id, tenant_id, name, city, address) VALUES ($1, $2, $3, $4, $5)",
      [locationId, tenantId, "Sucursal Central", "Buenos Aires", "Av. Cabildo 1234"]
    );
    console.log("Sucursal Central creada.");

    // 5. Crear Producto: 'Remera Básica'
    const productId = "d3b07384-d113-4ec2-a5d6-c8402b89f819";
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
    const optionColorId = "d3b07384-d113-4ec2-a5d6-c8402b89f820";
    const optionTalleId = "d3b07384-d113-4ec2-a5d6-c8402b89f821";
    await client.query(
      "INSERT INTO product_options (id, tenant_id, product_id, name) VALUES ($1, $2, $3, $4)",
      [optionColorId, tenantId, productId, "Color"]
    );
    await client.query(
      "INSERT INTO product_options (id, tenant_id, product_id, name) VALUES ($1, $2, $3, $4)",
      [optionTalleId, tenantId, productId, "Talle"]
    );

    // 7. Crear Valores de las Opciones
    const valNegroId = "d3b07384-d113-4ec2-a5d6-c8402b89f822";
    const valSId = "d3b07384-d113-4ec2-a5d6-c8402b89f823";
    const valMId = "d3b07384-d113-4ec2-a5d6-c8402b89f824";
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
    const variantSId = "d3b07384-d113-4ec2-a5d6-c8402b89f825";
    const variantMId = "d3b07384-d113-4ec2-a5d6-c8402b89f826";
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
    const invSId = "d3b07384-d113-4ec2-a5d6-c8402b89f827";
    const invMId = "d3b07384-d113-4ec2-a5d6-c8402b89f828";
    await client.query(
      `INSERT INTO inventory (id, tenant_id, product_variant_id, location_id, quantity) 
       VALUES ($1, $2, $3, $4, $5)`,
      [invSId, tenantId, variantSId, locationId, 10]
    );
    await client.query(
      `INSERT INTO inventory (id, tenant_id, product_variant_id, location_id, quantity) 
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
