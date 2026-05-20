import { expect, test } from "@playwright/test";

const apiBaseUrl = process.env.SMOKE_API_URL || "http://127.0.0.1:3000/api/v1";

test("authenticated trade smoke flow", async ({ page }) => {
  const email = `tradex.smoke.${Date.now()}@example.com`;
  const password = "TradeX123!";
  const notifications = page.getByRole("region", { name: /Trade X notifications/i });

  await page.goto("/signup");
  await page.getByTestId("auth-email-input").fill(email);
  await page.getByTestId("auth-password-input").fill(password);
  await page.getByTestId("auth-submit-button").click();
  try {
    await page.waitForURL(/\/trade$/, { timeout: 5000 });
  } catch {
    const signInResponse = await page.request.post(`${apiBaseUrl}/auth/signin`, {
      data: { email, password },
    });

    const authResponse = signInResponse.ok()
      ? signInResponse
      : await page.request.post(`${apiBaseUrl}/auth/signup`, {
          data: { email, password },
        });

    const authPayload = await authResponse.json();
    await page.evaluate(
      ({ token, userEmail }) => {
        window.localStorage.setItem("token", token);
        window.localStorage.setItem("userEmail", userEmail);
      },
      {
        token: authPayload.token as string,
        userEmail: email,
      }
    );
    await page.goto("/trade");
  }

  await expect(page).toHaveURL(/\/trade$/, { timeout: 20000 });
  await expect(page.getByTestId("trade-chart")).toBeVisible();
  await expect(page.getByTestId("price-feed-status")).toHaveText(/Price feed (connecting|connected|active|disconnected)/);
  await expect(page.getByTestId("price-feed-status")).toHaveText("Price feed active", {
    timeout: 30000,
  });

  const balanceSummary = page.getByTestId("balance-summary");
  await expect(balanceSummary).toBeVisible();
  const startingBalance = await balanceSummary.textContent();
  await page.getByTestId("order-slippage-input").fill("5");

  await page.getByTestId("open-long-button").click();
  await expect(notifications).toContainText("Long position opened");

  await page.getByTestId("open-short-button").click();
  await expect(notifications).toContainText("Short position opened");

  const positionsTable = page.getByTestId("desktop-positions-table");
  await expect(positionsTable).toBeVisible();
  await expect(positionsTable.getByTestId("open-position-row")).toHaveCount(2, { timeout: 20000 });

  await positionsTable.getByTestId("close-position-button").first().click();
  await expect(notifications).toContainText("Position closed");

  await expect(positionsTable.getByTestId("open-position-row")).toHaveCount(1, { timeout: 20000 });
  await expect(balanceSummary).not.toHaveText(startingBalance ?? "");

  await page.getByTestId("positions-tab-history").click();
  const tradeHistory = page.getByTestId("desktop-trade-history");
  await expect(tradeHistory).toBeVisible();
  await expect(tradeHistory.getByTestId("closed-trade-row")).toHaveCount(1, { timeout: 20000 });
});
