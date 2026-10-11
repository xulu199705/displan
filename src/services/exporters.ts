import {
  dimensions,
  layoutBox,
  monitorBox,
  boxWidth,
  boxHeight,
} from "../domain/geometry";
import { fmt, type LayoutDocument } from "../domain/types";

const escapeXml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function layoutSvg(doc: LayoutDocument): string {
  const bounds = layoutBox(doc);
  if (!bounds) throw new Error("请先添加显示器");
  const padding = 30,
    width = boxWidth(bounds) + 2 * padding,
    height = boxHeight(bounds) + 2 * padding;
  const shapes = doc.instances
    .map((i) => {
      const spec = doc.specs.find((s) => s.id === i.specId)!;
      const b = monitorBox(i, spec),
        { width: w, height: h } = dimensions(i, spec);
      const font = Math.min(24, w / 12, h / 5);
      const inset = Math.min(8, w * 0.04, h * 0.04);
      return `<g><rect x="${b.minX}" y="${b.minY}" width="${w}" height="${h}" rx="${Math.min(8, w / 10, h / 10)}" fill="#303947"/><rect x="${b.minX + inset}" y="${b.minY + inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" rx="${inset / 2}" fill="#dbe3ec"/><text x="${i.xMm}" y="${i.yMm - font / 4}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${font}" fill="#303947">${escapeXml(spec.name)}</text><text x="${i.xMm}" y="${i.yMm + font * 1.2}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${font * 0.65}" fill="#536174">${fmt(w)} × ${fmt(h)} mm</text></g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="${bounds.minX - padding} ${bounds.minY - padding} ${width} ${height}"><title>${escapeXml(doc.name)}</title><rect x="${bounds.minX - padding}" y="${bounds.minY - padding}" width="${width}" height="${height}" fill="white"/>${shapes}</svg>`;
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const safeFilename = (name: string) =>
  name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 100) || "displan";
export async function exportPng(doc: LayoutDocument) {
  const svg = layoutSvg(doc),
    b = layoutBox(doc)!;
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("PNG 图像生成失败"));
      image.src = url;
    });
    const w = boxWidth(b) + 60,
      h = boxHeight(b) + 60;
    const scale = Math.min(2, 4096 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器不支持 Canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("PNG 编码失败"))),
        "image/png",
      ),
    );
    downloadBlob(blob, `${safeFilename(doc.name)}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
