export type ExportableChart = {
  getDataURL: (opts: { type: 'png'; pixelRatio: number; backgroundColor: string }) => string;
  getWidth: () => number;
  getHeight: () => number;
};

export type ExportTarget = { key: string; from: string; to: string };

const SCALE = 2;
const WHITE = '#ffffff';

function rasterise(src: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * SCALE;
      canvas.height = height * SCALE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas is not available'));
      ctx.fillStyle = WHITE;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Could not render the chart image'));
    img.src = src;
  });
}

/** Downloads a chart as `applications-<key>-<from>_<to>.png` on a white background. */
export async function exportChartPng(chart: ExportableChart, { key, from, to }: ExportTarget): Promise<void> {
  const url = chart.getDataURL({ type: 'png', pixelRatio: SCALE, backgroundColor: WHITE });
  let href = url;
  if (!url.startsWith('data:image/png')) {
    // With the SVG renderer getDataURL returns an SVG data URL whatever `type` says,
    // so rasterise it onto a white canvas to produce a real PNG.
    const width = chart.getWidth();
    const height = chart.getHeight();
    if (!(width > 0) || !(height > 0)) throw new Error('Chart has no size');
    href = await rasterise(url, width, height);
  }
  const a = document.createElement('a');
  a.href = href;
  a.download = `applications-${key}-${from}_${to}.png`;
  a.click();
}
