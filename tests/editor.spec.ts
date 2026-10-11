import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

type Doc = {
  specs: { id: string; widthMm: number; heightMm: number; isCustom: boolean }[];
  instances: {
    id: string;
    specId: string;
    xMm: number;
    yMm: number;
    rotation: number;
    widthMm?: number;
  }[];
};
async function readDraft(page: Page): Promise<Doc> {
  await page.waitForTimeout(650);
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("displan.draft.v1")!),
  );
}
async function canvasPoint(page: Page, x: number, y: number) {
  const c = await page.getByLabel("布局白板", { exact: true }).boundingBox();
  if (!c) throw new Error("canvas missing");
  return { x: c.x + x, y: c.y + y };
}
async function examplePoint(page: Page, xMm: number, yMm: number) {
  const c = await page.getByLabel("布局白板", { exact: true }).boundingBox();
  if (!c) throw new Error("canvas missing");
  const scale = Math.min((c.width - 180) / 1233.8, (c.height - 180) / 718.3);
  return {
    x: c.x + c.width / 2 + (xMm - 1233.8 / 2) * scale,
    y: c.y + c.height / 2 + (yMm - 718.3 / 2) * scale,
    scale,
  };
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("layout-size")).toHaveText("1233.80 × 718.30");
});
test("example renders, bounds toggle retains stats, and view zoom does not alter world geometry", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const before = await readDraft(page);
  await page.getByRole("button", { name: "组合包围盒", exact: true }).click();
  await expect(page.getByTestId("layout-size")).toHaveText("1233.80 × 718.30");
  const point = await canvasPoint(page, 700, 350);
  await page.mouse.move(point.x, point.y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await page
    .getByRole("button", { name: "适合内容 (Fit)", exact: true })
    .click();
  expect((await readDraft(page)).instances).toEqual(before.instances);
  expect(errors).toEqual([]);
});
test("library repeats, rotate and precise edit preserve preset size; undo redo and keyboard focus", async ({
  page,
}) => {
  await page.getByRole("button", { name: "新建方案", exact: true }).click();
  await page
    .getByRole("button", { name: "添加 Dell U3425WE", exact: true })
    .click();
  await page
    .getByRole("button", { name: "添加 Dell U3425WE", exact: true })
    .click();
  await expect(page.getByTestId("monitor-count")).toHaveText("2");
  await expect(
    page.getByRole("button", { name: "添加 Dell U3425WE", exact: true }),
  ).toHaveCount(1);
  const original = await readDraft(page);
  await expect(page.getByLabel("型号宽度", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await page.getByLabel("X 坐标", { exact: true }).fill("123.4567");
  await page.getByLabel("X 坐标", { exact: true }).press("Enter");
  await page.getByRole("button", { name: "旋转 90° (R)", exact: true }).click();
  const rotated = await readDraft(page);
  expect(rotated.instances[1].rotation).toBe(90);
  expect(rotated.instances[1].xMm).toBe(123.4567);
  expect(rotated.instances[1].yMm).toBe(original.instances[1].yMm);
  await page
    .getByRole("button", { name: "撤销 (Ctrl+Z)", exact: true })
    .click();
  expect((await readDraft(page)).instances[1].rotation).toBe(0);
  await page
    .getByRole("button", { name: "重做 (Ctrl+Y)", exact: true })
    .click();
  expect((await readDraft(page)).instances[1].rotation).toBe(90);
  await page.getByLabel("X 坐标", { exact: true }).focus();
  await page.keyboard.press("r");
  expect((await readDraft(page)).instances[1].rotation).toBe(90);
  await page.getByLabel("X 坐标", { exact: true }).press("Escape");
  await page.getByLabel("布局白板", { exact: true }).focus();
  await page.keyboard.press("Shift+ArrowRight");
  expect((await readDraft(page)).instances[1].xMm).toBe(133.4567);
  await page.keyboard.press("Control+d");
  await expect(page.getByTestId("monitor-count")).toHaveText("3");
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("monitor-count")).toHaveText("2");
});
test("DOM drop uses pointer location; Alt drag is one history step and does not resize", async ({
  page,
}) => {
  await page.getByRole("button", { name: "新建方案", exact: true }).click();
  const canvas = page.getByLabel("布局白板", { exact: true }),
    rect = await canvas.boundingBox();
  if (!rect) throw new Error("missing canvas");
  const card = page.locator(".monitor-card").first(),
    transfer = await page.evaluateHandle(() => new DataTransfer());
  await card.dispatchEvent("dragstart", { dataTransfer: transfer });
  await canvas.dispatchEvent("drop", {
    dataTransfer: transfer,
    clientX: rect.x + rect.width / 2,
    clientY: rect.y + rect.height / 2,
  });
  const before = await readDraft(page);
  expect(before.instances).toHaveLength(1);
  expect(before.instances[0].xMm).toBeCloseTo(0, 6);
  expect(before.instances[0].yMm).toBeCloseTo(0, 6);
  await page.getByRole("button", { name: "取消选择", exact: true }).click();
  const p = await canvasPoint(page, rect.width / 2, rect.height / 2);
  await page.keyboard.down("Alt");
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 80, p.y + 35, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  const after = await readDraft(page);
  expect(after.instances[0].xMm).toBeCloseTo(160, 6);
  expect(after.instances[0].yMm).toBeCloseTo(70, 6);
  expect(after.specs).toEqual(before.specs);
  await page
    .getByRole("button", { name: "撤销 (Ctrl+Z)", exact: true })
    .click();
  expect((await readDraft(page)).instances).toEqual(before.instances);
});
test("save, refresh, JSON round trip, invalid imports and SVG/PNG exports", async ({
  page,
}) => {
  await page.getByLabel("方案名称", { exact: true }).fill("验证布局");
  await page.getByRole("button", { name: "保存方案", exact: true }).click();
  const before = await readDraft(page);
  await page.reload();
  await expect(page.getByLabel("方案名称", { exact: true })).toHaveValue(
    "验证布局",
  );
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const jsonPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON", exact: false }).click();
  const json = await jsonPromise;
  const jsonPath = await json.path();
  expect(jsonPath).toBeTruthy();
  await page.getByRole("button", { name: "新建方案", exact: true }).click();
  await page.getByLabel("导入布局文件").setInputFiles(jsonPath!);
  await expect(page.getByTestId("monitor-count")).toHaveText("3");
  expect((await readDraft(page)).instances).toEqual(before.instances);
  await page.getByLabel("导入布局文件").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.getByRole("status")).toContainText("schemaVersion");
  await expect(page.getByTestId("monitor-count")).toHaveText("3");
  for (const type of ["SVG", "PNG"]) {
    await page.getByRole("button", { name: "导出", exact: true }).click();
    const promise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: `导出 ${type}`, exact: false })
      .click();
    const file = await promise;
    expect(file.suggestedFilename()).toBe(`验证布局.${type.toLowerCase()}`);
    const bytes = readFileSync((await file.path())!);
    if (type === "PNG") {
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      expect(bytes.readUInt32BE(16)).toBe(2588);
      expect(bytes.readUInt32BE(20)).toBe(1557);
    } else {
      expect(bytes.toString()).toContain('viewBox="-30 -30 1293.8 778.3"');
      expect(bytes.toString()).not.toContain("dash");
    }
  }
  await page.getByRole("button", { name: "本地方案列表", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("验证布局");
  await page
    .getByRole("button", { name: "删除方案 验证布局", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("还没有保存的方案");
});
test("custom physical and estimated specs can be edited numerically and undone", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "创建自定义显示器", exact: false })
    .click();
  await page.getByLabel("自定义宽度", { exact: true }).fill("600.12");
  await page.getByLabel("自定义高度", { exact: true }).fill("340.56");
  await page.getByRole("button", { name: "创建型号", exact: true }).click();
  await expect(page.getByTestId("monitor-count")).toHaveText("4");
  await page.getByLabel("型号宽度", { exact: true }).fill("620.1234");
  await page.getByLabel("型号宽度", { exact: true }).press("Enter");
  expect((await readDraft(page)).instances[3].widthMm).toBe(620.1234);
  await page
    .getByRole("button", { name: "撤销 (Ctrl+Z)", exact: true })
    .click();
  expect((await readDraft(page)).instances[3].widthMm).toBeUndefined();
  await page
    .getByRole("button", { name: "创建自定义显示器", exact: false })
    .click();
  await page.getByRole("button", { name: "对角线与比例", exact: true }).click();
  await page.getByRole("button", { name: "计算估算尺寸", exact: true }).click();
  await page.getByRole("button", { name: "创建型号", exact: true }).click();
  await expect(page.getByTestId("monitor-count")).toHaveText("5");
});
test("measurement groups match the Dell fixture and update after rotation and deletion", async ({
  page,
}) => {
  const top = await examplePoint(page, 827.07, 179.575),
    bottom = await examplePoint(page, 827.07, 538.725),
    portrait = await examplePoint(page, 205.17, 359.15);
  await page.mouse.click(top.x, top.y);
  await page.keyboard.down("Shift");
  await page.mouse.click(bottom.x, bottom.y);
  await page.keyboard.up("Shift");
  await expect(page.getByLabel("显示器属性", { exact: true })).toContainText(
    "813.46 × 718.30",
  );
  await page.getByRole("button", { name: "测量工具", exact: true }).click();
  await page
    .getByRole("button", { name: "将所选 2 台设为目标 A", exact: true })
    .click();
  await page.mouse.click(portrait.x, portrait.y);
  const panel = page.getByLabel("测量结果", { exact: true });
  await expect(
    panel.locator("div", {
      has: page.locator("dt", { hasText: "X 边缘间距" }),
    }),
  ).toContainText("10.00 mm");
  await expect(
    panel.locator("div", { has: page.locator("dt", { hasText: "顶边偏差" }) }),
  ).toContainText("+2.55 mm");
  await expect(
    panel.locator("div", { has: page.locator("dt", { hasText: "底边偏差" }) }),
  ).toContainText("-2.55 mm");
  await page.screenshot({
    path: "docs/screenshots/displan-measurement.png",
    fullPage: true,
  });
  const lowerPortrait = await examplePoint(page, 205.17, 630);
  await page.keyboard.down("Alt");
  await page.mouse.move(lowerPortrait.x, lowerPortrait.y);
  await page.mouse.down();
  await page.mouse.move(
    lowerPortrait.x,
    lowerPortrait.y + 10 * lowerPortrait.scale,
    { steps: 5 },
  );
  await page.mouse.up();
  await page.keyboard.up("Alt");
  const movedPortrait = (await readDraft(page)).instances[2];
  expect(Math.abs(movedPortrait.yMm - 359.15 - 10)).toBeLessThan(
    1 / lowerPortrait.scale,
  );
  await expect(
    panel.locator("div", { has: page.locator("dt", { hasText: "顶边偏差" }) }),
  ).toContainText(`+${(movedPortrait.yMm - 713.2 / 2).toFixed(2)} mm`);
  await page.getByLabel("布局白板", { exact: true }).focus();
  await page.keyboard.press("r");
  await expect(
    panel.locator("div", { has: page.locator("dt", { hasText: "顶边偏差" }) }),
  ).toContainText(`+${(movedPortrait.yMm - 410.34 / 2).toFixed(2)} mm`);
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("monitor-count")).toHaveText("2");
  await expect(panel).not.toContainText("顶边偏差");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});
test("edge snap, shift axis constraint, locking and canvas pan behave physically", async ({
  page,
}) => {
  const start = await examplePoint(page, 827.07, 179.575);
  const before = await readDraft(page);
  // Shift keeps Y fixed; the nearest candidate is the 20 mm gap to the portrait.
  await page.keyboard.down("Shift");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 5, start.y + 2, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  const shifted = await readDraft(page);
  expect(shifted.instances[0].yMm).toBe(before.instances[0].yMm);
  expect(shifted.instances[0].xMm).toBeCloseTo(before.instances[0].xMm + 10, 6);
  await page.getByRole("button", { name: "锁定", exact: true }).click();
  await page.getByLabel("布局白板", { exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("monitor-count")).toHaveText("3");
  expect((await readDraft(page)).instances[0].xMm).toBe(
    shifted.instances[0].xMm,
  );
  await page.getByRole("button", { name: "解锁", exact: true }).click();
  // Nearest edge is the portrait top (2.55 mm), rather than the stack top (0).
  await page.keyboard.down("Alt");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - 50, start.y - 35, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await page.mouse.move(start.x - 50, start.y - 35);
  await page.mouse.down();
  await page.mouse.move(start.x + 3, start.y + 5, { steps: 5 });
  await page.mouse.up();
  expect((await readDraft(page)).instances[0].xMm).toBeCloseTo(
    shifted.instances[0].xMm,
    6,
  );
  expect((await readDraft(page)).instances[0].yMm).toBeCloseTo(
    before.instances[0].yMm + 2.55,
    6,
  );
  const beforePan = await readDraft(page);
  const p = await canvasPoint(page, 400, 50);
  await page.getByLabel("布局白板", { exact: true }).focus();
  await page.keyboard.down("Space");
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 200, p.y + 100, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  expect((await readDraft(page)).instances).toEqual(beforePan.instances);
});
test("desktop and narrow viewport layout remain usable", async ({ page }) => {
  await expect(page.getByLabel("布局白板", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/displan-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 800, height: 850 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "展开仓库", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("layout-size")).toHaveText("1233.80 × 718.30");
  await page.getByRole("button", { name: "展开仓库", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "添加 Dell U3425WE", exact: true }),
  ).toBeVisible();
});
test("Shift-drag retains an existing selection, while Shift-click deselects", async ({
  page,
}) => {
  const p = await examplePoint(page, 827.07, 179.575);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByLabel("显示器属性", { exact: true })).toBeVisible();
  const before = await readDraft(page);
  await page.keyboard.down("Shift");
  await page.keyboard.down("Alt");
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 25, p.y + 8, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await page.keyboard.up("Shift");
  const after = await readDraft(page);
  expect(after.instances[0].yMm).toBe(before.instances[0].yMm);
  expect(
    Math.abs(after.instances[0].xMm - before.instances[0].xMm - 25 / p.scale),
  ).toBeLessThan(1 / p.scale);
  await expect(page.getByLabel("显示器属性", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "撤销 (Ctrl+Z)", exact: true })
    .click();
  await page.keyboard.down("Shift");
  await page.mouse.click(p.x, p.y);
  await page.keyboard.up("Shift");
  await expect(page.getByLabel("显示器属性", { exact: true })).toHaveCount(0);
});
