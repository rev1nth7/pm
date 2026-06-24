import { expect, test, type Page } from "@playwright/test";

// The board now sits behind a login gate. These tests run against `next dev`
// (no backend), so the /api/* auth calls are stubbed with route interception.
const mockAuthenticated = (page: Page) =>
  page.route("**/api/me", (route) =>
    route.fulfill({ json: { authenticated: true, username: "user" } })
  );

test.describe("kanban board (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticated(page);
  });

  test("loads the kanban board", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Kanban Studio" })
    ).toBeVisible();
    await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  });

  test("adds a card to a column", async ({ page }) => {
    await page.goto("/");
    const firstColumn = page.locator('[data-testid^="column-"]').first();
    await firstColumn.getByRole("button", { name: /add a card/i }).click();
    await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
    await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
    await firstColumn.getByRole("button", { name: /add card/i }).click();
    await expect(firstColumn.getByText("Playwright card")).toBeVisible();
  });

  test("moves a card between columns", async ({ page }) => {
    await page.goto("/");
    const card = page.getByTestId("card-card-1");
    const targetColumn = page.getByTestId("column-col-review");
    const cardBox = await card.boundingBox();
    const columnBox = await targetColumn.boundingBox();
    if (!cardBox || !columnBox) {
      throw new Error("Unable to resolve drag coordinates.");
    }

    await page.mouse.move(
      cardBox.x + cardBox.width / 2,
      cardBox.y + cardBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      columnBox.x + columnBox.width / 2,
      columnBox.y + 120,
      { steps: 12 }
    );
    await page.mouse.up();
    await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
  });
});

test("login gate: rejects bad creds, then reveals the board", async ({ page }) => {
  let authed = false;
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: { authenticated: authed, username: authed ? "user" : null },
    })
  );
  await page.route("**/api/login", async (route) => {
    const body = route.request().postDataJSON();
    if (body.username === "user" && body.password === "password") {
      authed = true;
      await route.fulfill({ json: { authenticated: true, username: "user" } });
    } else {
      await route.fulfill({ status: 401, json: { detail: "Invalid" } });
    }
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toBeHidden();

  // Wrong password: shows an error, board stays hidden.
  await page.getByLabel(/username/i).fill("user");
  await page.getByLabel(/password/i).fill("wrong");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/invalid username or password/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toBeHidden();

  // Correct password: board appears.
  await page.getByLabel(/password/i).fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toBeVisible();
});
