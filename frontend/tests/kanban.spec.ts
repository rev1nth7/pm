import { expect, test, type Page } from "@playwright/test";

// The board now loads from and saves to the backend. These tests run against
// `next dev` (no backend), so the /api/* calls are stubbed with route
// interception. A small seed board mirrors the backend default.
const seedBoard = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    { id: "col-progress", title: "In Progress", cardIds: ["card-4"] },
    { id: "col-review", title: "Review", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", cardIds: ["card-7"] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Align roadmap themes", details: "Draft themes." },
    "card-2": { id: "card-2", title: "Gather customer signals", details: "Review tags." },
    "card-3": { id: "card-3", title: "Prototype analytics view", details: "Sketch layout." },
    "card-4": { id: "card-4", title: "Refine status language", details: "Standardize labels." },
    "card-6": { id: "card-6", title: "QA micro-interactions", details: "Verify states." },
    "card-7": { id: "card-7", title: "Ship marketing page", details: "Final copy." },
  },
};

const mockAuthenticated = (page: Page) =>
  page.route("**/api/me", (route) =>
    route.fulfill({ json: { authenticated: true, username: "user" } })
  );

const mockBoard = (page: Page, onPut?: (body: unknown) => void) =>
  page.route("**/api/board", (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      onPut?.(body);
      return route.fulfill({ json: body });
    }
    return route.fulfill({ json: seedBoard });
  });

test.describe("kanban board (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticated(page);
    await mockBoard(page);
  });

  test("loads the kanban board from the API", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Kanban Studio" })
    ).toBeVisible();
    await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
    await expect(page.getByText("Align roadmap themes")).toBeVisible();
  });

  test("adds a card and persists it via PUT", async ({ page }) => {
    let putBody: any = null;
    await mockBoard(page, (body) => {
      putBody = body;
    });

    await page.goto("/");
    const firstColumn = page.locator('[data-testid^="column-"]').first();
    await firstColumn.getByRole("button", { name: /add a card/i }).click();
    await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
    await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
    await firstColumn.getByRole("button", { name: /add card/i }).click();

    await expect(firstColumn.getByText("Playwright card")).toBeVisible();
    await expect.poll(() => putBody).not.toBeNull();
  });

  test("edits a card's details", async ({ page }) => {
    await page.goto("/");
    const card = page.getByTestId("card-card-1");
    await card.getByRole("button", { name: /edit align roadmap themes/i }).click();
    await card.getByLabel("Card details").fill("Edited via e2e.");
    await card.getByRole("button", { name: /^save$/i }).click();
    await expect(card.getByText("Edited via e2e.")).toBeVisible();
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
  await mockBoard(page);

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
