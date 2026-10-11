import { expect, test } from "@playwright/test";
import type { LayoutDocument } from "../src/domain/types";

// Resolve an ordinary HTTP origin locally, without making it a secure context.
// No browser security overrides and no mocks of the crypto API are used.
test.use({
  launchOptions: {
    args: [
      "--host-resolver-rules=MAP displan.test 127.0.0.1",
      "--no-proxy-server",
    ],
  },
});

test("insecure HTTP supports all UUID creation paths and persistent layouts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://displan.test:5173/");
  expect(
    await page.evaluate(() => ({
      secure: window.isSecureContext,
      randomUUID: typeof crypto.randomUUID,
      getRandomValues: typeof crypto.getRandomValues,
    })),
  ).toEqual({
    secure: false,
    randomUUID: "undefined",
    getRandomValues: "function",
  });
  await expect(page.getByTestId("layout-size")).toHaveText("1233.80 × 718.30");
  await expect(page.getByLabel("布局白板", { exact: true })).toBeVisible();

  const readSaved = async (): Promise<LayoutDocument> => {
    await page.getByRole("button", { name: "保存方案", exact: true }).click();
    return page.evaluate(() =>
      JSON.parse(localStorage.getItem("displan.draft.v1")!),
    );
  };
  const generated: string[] = [];
  const collect = (doc: LayoutDocument) => {
    generated.push(doc.id, ...doc.instances.map((instance) => instance.id));
  };
  collect(await readSaved());

  await page.getByRole("button", { name: "新建方案", exact: true }).click();
  await expect(page.getByTestId("monitor-count")).toHaveText("0");
  const blank = await readSaved();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "添加 Dell U3425WE", exact: true })
      .click();
  }
  await page.getByLabel("布局白板", { exact: true }).focus();
  await page.keyboard.press("Control+d");
  await expect(page.getByTestId("monitor-count")).toHaveText("3");
  await page
    .getByRole("button", { name: "撤销 (Ctrl+Z)", exact: true })
    .click();
  await expect(page.getByTestId("monitor-count")).toHaveText("2");
  await page
    .getByRole("button", { name: "重做 (Ctrl+Y)", exact: true })
    .click();
  await expect(page.getByTestId("monitor-count")).toHaveText("3");

  await page
    .getByRole("button", { name: "创建自定义显示器", exact: false })
    .click();
  await page.getByLabel("型号名称", { exact: true }).fill("HTTP 自定义型号");
  await page.getByRole("button", { name: "创建型号", exact: true }).click();
  await expect(page.getByTestId("monitor-count")).toHaveText("4");
  await page.getByLabel("方案名称", { exact: true }).fill("HTTP 回归方案");
  const saved = await readSaved();
  expect(saved.id).toBe(blank.id);
  collect(saved);
  const custom = saved.specs.find((spec) => spec.isCustom)!;
  expect(custom.name).toBe("HTTP 自定义型号");
  expect(saved.instances.at(-1)?.specId).toBe(custom.id);
  generated.push(custom.id);

  await page.reload();
  await expect(page.getByTestId("monitor-count")).toHaveText("4");
  await expect(page.getByLabel("方案名称", { exact: true })).toHaveValue(
    "HTTP 回归方案",
  );
  expect(await readSaved()).toEqual(saved);
  await expect(
    page.getByRole("button", { name: "添加 HTTP 自定义型号", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  await expect(page.getByTestId("layout-size")).toHaveText("1233.80 × 718.30");
  collect(await readSaved());
  expect(new Set(generated).size).toBe(generated.length);
  for (const id of generated) {
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  }
  await page.getByLabel("导入布局文件").setInputFiles({
    name: "http-layout.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await expect(page.getByTestId("monitor-count")).toHaveText("4");
  expect(await readSaved()).toEqual(saved);
  expect(errors).toEqual([]);
});
