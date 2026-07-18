import { test, expect } from '@playwright/test';

test.describe('Flujo de Checkout y Compra', () => {
  test('Debe completar el Guest Checkout exitosamente', async ({ page }) => {
    // 1. Interceptar cotización de envío
    await page.route('**/logistics/quote', async (route) => {
      console.log('➜ PLAYWRIGHT INTERCEPTED: **/logistics/quote');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          opciones: [
            {
              nombre: 'Andreani Estándar',
              tarifa: 1500,
              plazo: 3,
            },
          ],
        }),
      });
    });

    // 2. Interceptar creación de orden/preferencia
    await page.route('**/orders', async (route) => {
      console.log('➜ PLAYWRIGHT INTERCEPTED: **/orders');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            initPoint: 'https://sandbox.mercadopago.com/mock-checkout',
          },
        }),
      });
    });

    // 3. Interceptar la navegación final a Mercado Pago para evitar que intente cargar la red real
    await page.route('https://sandbox.mercadopago.com/mock-checkout', async (route) => {
      console.log('➜ PLAYWRIGHT INTERCEPTED: Mercadopago Redirect');
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<h1>Mocked Mercado Pago Checkout</h1>',
      });
    });

    // 4. Navegar a la página de inicio (utiliza baseURL: http://localhost:3000)
    await page.goto('/');

    // 5. Buscar el producto "Producto Test Alpha"
    const productLink = page.locator('text=Producto Test Alpha');
    await expect(productLink).toBeVisible();
    await productLink.click();

    // 6. En la página del producto, hacer click en "Comprar"
    const buyButton = page.locator('text=Comprar');
    await expect(buyButton).toBeVisible();
    await buyButton.click();

    // 7. Rellenar formulario de datos personales y envío en el checkout
    await page.fill('#email', 'cliente_test@example.com');
    await page.fill('#fullName', 'Juan Pérez');
    await page.fill('#address', 'Av. del Libertador 1234');
    await page.fill('#city', 'Buenos Aires');
    await page.fill('#postalCode', '1425');
    await page.fill('#phone', '1123456789');

    // 8. Calcular envío en el calculador
    const calcForm = page.locator('form:has(input[placeholder="Tu Código Postal (ej: 1425)"])');
    const zipInput = calcForm.locator('input[placeholder="Tu Código Postal (ej: 1425)"]');
    await expect(zipInput).toBeVisible();
    await zipInput.click();
    await zipInput.fill('1425');

    const calculateButton = calcForm.locator('button:has-text("Calcular")');
    await calculateButton.click();

    // Esperar un breve momento para la respuesta de red mockeada
    await page.waitForTimeout(1500);
    console.log('--- CHECKOUT PAGE HTML CONTENT AFTER CALCULATION ---');
    console.log(await page.content());
    console.log('----------------------------------------------------');

    // 9. Seleccionar la opción de envío mockeada "Andreani Estándar"
    const shippingOption = page.locator('text=Andreani Estándar');
    await expect(shippingOption).toBeVisible();
    await shippingOption.click();

    // 10. Clickear en "Pagar con Mercado Pago"
    const payButton = page.locator('button:has-text("Pagar con Mercado Pago")');
    await expect(payButton).toBeVisible();
    await payButton.click();

    // 11. Aserción final: verificar redirección a Mercado Pago
    await page.waitForURL('https://sandbox.mercadopago.com/mock-checkout');
    expect(page.url()).toBe('https://sandbox.mercadopago.com/mock-checkout');
  });
});
