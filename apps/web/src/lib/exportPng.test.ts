import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportChartPng, type ExportableChart } from './exportPng';

const SVG = 'data:image/svg+xml;charset=UTF-8,%3Csvg%2F%3E';
const target = { key: 'by-status', from: '2026-01-01', to: '2026-03-31' };

function chart(url: string, width = 400, height = 300): ExportableChart & { getDataURL: ReturnType<typeof vi.fn> } {
  return { getDataURL: vi.fn(() => url), getWidth: () => width, getHeight: () => height };
}

describe('exportChartPng', () => {
  const calls: string[] = [];
  let downloads: { name: string; href: string }[];
  let canvasSize: { w: number; h: number };
  let imageFails: boolean;

  beforeEach(() => {
    calls.length = 0;
    downloads = [];
    imageFails = false;
    const ctx = {
      set fillStyle(v: string) {
        calls.push(`fillStyle=${v}`);
      },
      fillRect: (...a: number[]) => calls.push(`fillRect(${a.join(',')})`),
      drawImage: () => calls.push('drawImage'),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      canvasSize = { w: this.width, h: this.height };
      return ctx as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,RASTER');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ name: this.download, href: this.href });
    });
    vi.stubGlobal(
      'Image',
      class {
        onload: () => void = () => {};
        onerror: () => void = () => {};
        set src(_v: string) {
          queueMicrotask(() => (imageFails ? this.onerror() : this.onload()));
        }
      },
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('asks echarts for a white 2x png and downloads under the expected name when it is already a png', async () => {
    const c = chart('data:image/png;base64,AAAA');
    await exportChartPng(c, target);
    expect(c.getDataURL).toHaveBeenCalledWith({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
    expect(downloads).toEqual([{ name: 'applications-by-status-2026-01-01_2026-03-31.png', href: 'data:image/png;base64,AAAA' }]);
    expect(calls).toEqual([]);
  });

  it('rasterises an svg data url: white fill before draw, at 2x size', async () => {
    await exportChartPng(chart(SVG, 400, 300), target);
    expect(canvasSize).toEqual({ w: 800, h: 600 });
    expect(calls).toEqual(['fillStyle=#ffffff', 'fillRect(0,0,800,600)', 'drawImage']);
    expect(downloads).toEqual([
      { name: 'applications-by-status-2026-01-01_2026-03-31.png', href: 'data:image/png;base64,RASTER' },
    ]);
  });

  it('rejects clearly for a zero-sized chart and downloads nothing', async () => {
    await expect(exportChartPng(chart(SVG, 0, 0), target)).rejects.toThrow('Chart has no size');
    expect(downloads).toEqual([]);
  });

  it('rejects when the image cannot be loaded', async () => {
    imageFails = true;
    await expect(exportChartPng(chart(SVG), target)).rejects.toThrow('Could not render the chart image');
    expect(downloads).toEqual([]);
  });
});
