export type TextLabelType =
  | 'headline'
  | 'subtitle'
  | 'phone'
  | 'body'
  | 'logo_text'
  | 'badge';

export type FontStyleType =
  | 'times_new_roman'
  | 'kufi'
  | 'naskh_serif'
  | 'ruqaa_calligraphy'
  | 'heavy_display'
  | 'rounded_modern'
  | 'corporate_clean'
  | 'geometric_sans';

export const FONT_WEIGHT_OPTIONS: {
  value: string;
  label: string;
}[] = [
  { value: '300', label: '300 — خفيف (Light)' },
  { value: '400', label: '400 — عادي (Regular)' },
  { value: '500', label: '500 — متوسط (Medium)' },
  { value: '600', label: '600 — شبه عريض (Semi-Bold)' },
  { value: '700', label: '700 — عريض (Bold)' },
  { value: '800', label: '800 — عريض جداً (Extra-Bold)' },
  { value: '900', label: '900 — ثقيل (Black)' },
];

export const FONT_STYLE_OPTIONS: Record<
  FontStyleType,
  { label: string; cssFamily: string; defaultWeight: string }
> = {
  times_new_roman: {
    label: 'خط تايمز نيو رومان (Times New Roman)',
    cssFamily: '"Times New Roman", "Tinos", "Amiri", Georgia, serif',
    defaultWeight: '700',
  },
  geometric_sans: {
    label: 'خط كايرو هندسي (Cairo)',
    cssFamily: '"Cairo", "Readex Pro", sans-serif',
    defaultWeight: '700',
  },
  rounded_modern: {
    label: 'خط تجوال إعلاني ناعم (Tajawal)',
    cssFamily: '"Tajawal", "Cairo", sans-serif',
    defaultWeight: '700',
  },
  corporate_clean: {
    label: 'خط المراعي التجاري (Almarai)',
    cssFamily: '"Almarai", "IBM Plex Sans Arabic", sans-serif',
    defaultWeight: '700',
  },
  heavy_display: {
    label: 'خط بوستر عريض (Changa / Lalezar)',
    cssFamily: '"Changa", "Lalezar", "Cairo", sans-serif',
    defaultWeight: '800',
  },
  kufi: {
    label: 'خط كوفي أصيل (Noto Kufi)',
    cssFamily: '"Noto Kufi Arabic", "Cairo", sans-serif',
    defaultWeight: '700',
  },
  naskh_serif: {
    label: 'خط نسخ كلاسيكي (Amiri)',
    cssFamily: '"Amiri", "Times New Roman", serif',
    defaultWeight: '700',
  },
  ruqaa_calligraphy: {
    label: 'خط رقعة ديواني (Aref Ruqaa)',
    cssFamily: '"Aref Ruqaa", "Amiri", serif',
    defaultWeight: '700',
  },
};

export interface DetectedTextItem {
  id: number;
  label: TextLabelType;
  position: string;
  text: string;
  originalText: string;
  initialText?: string;
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    bgColor?: string;
    fontSize?: number;
    fontStyle?: FontStyleType | string;
    fontWeight?: string;
    fontItalic?: boolean;
    align?: 'center' | 'right' | 'left';
    hasShadow?: boolean;
    strokeColor?: string;
  };
}

export const LABEL_TRANSLATIONS: Record<TextLabelType, string> = {
  headline: 'عنوان رئيسي (headline)',
  subtitle: 'عنوان فرعي (subtitle)',
  phone: 'رقم تواصل (phone)',
  body: 'نص تفصيلي (body)',
  logo_text: 'نص الشعار (logo_text)',
  badge: 'شارة ترويجية (badge)',
};

/**
 * Seamlessly removes original text glyphs inside [bx, by, bw, bh] using
 * bilinear perimeter interpolation + dilated glyph-mask feathering so NO rectangular
 * box or solid patch is ever visible, and returns the exact sampled glyph color.
 */
function inpaintTextGlyphsSeamlessly(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): { sampledTextColor: string; avgBgLuminance: number } {
  const padX = Math.max(6, Math.round(W * 0.008));
  const padY = Math.max(5, Math.round(H * 0.007));

  const rx = Math.max(0, Math.floor(bx - padX));
  const ry = Math.max(0, Math.floor(by - padY));
  const rw = Math.min(W - rx, Math.ceil(bw + padX * 2));
  const rh = Math.min(H - ry, Math.ceil(bh + padY * 2));

  if (rw <= 4 || rh <= 4) {
    return { sampledTextColor: '#FFFFFF', avgBgLuminance: 0.2 };
  }

  const imgData = ctx.getImageData(rx, ry, rw, rh);
  const data = imgData.data;
  const orig = new Uint8ClampedArray(data);

  const getOrigRGB = (x: number, y: number): [number, number, number] => {
    const cx = Math.max(0, Math.min(rw - 1, Math.round(x)));
    const cy = Math.max(0, Math.min(rh - 1, Math.round(y)));
    const idx = (cy * rw + cx) * 4;
    return [orig[idx], orig[idx + 1], orig[idx + 2]];
  };

  // Build smoothed top, bottom, left, right boundary color profiles from the outer ring
  const topProfile: [number, number, number][] = new Array(rw);
  const bottomProfile: [number, number, number][] = new Array(rw);
  for (let x = 0; x < rw; x++) {
    let tr = 0,
      tg = 0,
      tb = 0,
      br = 0,
      bg = 0,
      bb = 0,
      cnt = 0;
    for (let dx = -2; dx <= 2; dx++) {
      const [r1, g1, b1] = getOrigRGB(x + dx, 1);
      const [r2, g2, b2] = getOrigRGB(x + dx, rh - 2);
      tr += r1;
      tg += g1;
      tb += b1;
      br += r2;
      bg += g2;
      bb += b2;
      cnt++;
    }
    topProfile[x] = [tr / cnt, tg / cnt, tb / cnt];
    bottomProfile[x] = [br / cnt, bg / cnt, bb / cnt];
  }

  const leftProfile: [number, number, number][] = new Array(rh);
  const rightProfile: [number, number, number][] = new Array(rh);
  for (let y = 0; y < rh; y++) {
    let lr = 0,
      lg = 0,
      lb = 0,
      rr = 0,
      rg = 0,
      rb = 0,
      cnt = 0;
    for (let dy = -2; dy <= 2; dy++) {
      const [r1, g1, b1] = getOrigRGB(1, y + dy);
      const [r2, g2, b2] = getOrigRGB(rw - 2, y + dy);
      lr += r1;
      lg += g1;
      lb += b1;
      rr += r2;
      rg += g2;
      rb += b2;
      cnt++;
    }
    leftProfile[y] = [lr / cnt, lg / cnt, lb / cnt];
    rightProfile[y] = [rr / cnt, rg / cnt, rb / cnt];
  }

  // Compute interpolated background buffer and detect high-contrast glyph pixels
  const bgBuffer = new Float32Array(rw * rh * 3);
  const diffMap = new Float32Array(rw * rh);

  let bgLumSum = 0;
  const glyphSamples: { r: number; g: number; b: number; diff: number }[] = [];

  for (let y = 0; y < rh; y++) {
    const v = rh > 1 ? y / (rh - 1) : 0.5;
    const wy = Math.max(0.05, Math.min(v, 1 - v));
    for (let x = 0; x < rw; x++) {
      const u = rw > 1 ? x / (rw - 1) : 0.5;
      const wx = Math.max(0.05, Math.min(u, 1 - u));

      // Vertical linear interpolation
      const vr = topProfile[x][0] * (1 - v) + bottomProfile[x][0] * v;
      const vg = topProfile[x][1] * (1 - v) + bottomProfile[x][1] * v;
      const vb = topProfile[x][2] * (1 - v) + bottomProfile[x][2] * v;

      // Horizontal linear interpolation
      const hr = leftProfile[y][0] * (1 - u) + rightProfile[y][0] * u;
      const hg = leftProfile[y][1] * (1 - u) + rightProfile[y][1] * u;
      const hb = leftProfile[y][2] * (1 - u) + rightProfile[y][2] * u;

      // Inverse-distance weighted blend of vertical and horizontal scanlines
      const wVert = wx / (wx + wy);
      const wHoriz = wy / (wx + wy);

      const br = vr * wVert + hr * wHoriz;
      const bg = vg * wVert + hg * wHoriz;
      const bb = vb * wVert + hb * wHoriz;

      const pIdx = y * rw + x;
      bgBuffer[pIdx * 3] = br;
      bgBuffer[pIdx * 3 + 1] = bg;
      bgBuffer[pIdx * 3 + 2] = bb;

      bgLumSum += (0.299 * br + 0.587 * bg + 0.114 * bb) / 255;

      const oIdx = pIdx * 4;
      const or = orig[oIdx];
      const og = orig[oIdx + 1];
      const ob = orig[oIdx + 2];

      const colorDist = Math.hypot(or - br, og - bg, ob - bb);
      diffMap[pIdx] = colorDist;

      // Collect candidate text glyph pixels from the inner region
      if (
        x > padX &&
        x < rw - padX &&
        y > padY &&
        y < rh - padY &&
        colorDist > 36
      ) {
        glyphSamples.push({ r: or, g: og, b: ob, diff: colorDist });
      }
    }
  }

  // Dilate diffMap by 3px so anti-aliased glyph halos and shadows are also cleanly erased
  const dilatedDiff = new Float32Array(rw * rh);
  const dilateRadius = 3;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      let maxD = 0;
      for (let dy = -dilateRadius; dy <= dilateRadius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= rh) continue;
        for (let dx = -dilateRadius; dx <= dilateRadius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= rw) continue;
          const d = diffMap[ny * rw + nx];
          if (d > maxD) maxD = d;
        }
      }
      dilatedDiff[y * rw + x] = maxD;
    }
  }

  // Feather mask near the outer perimeter so boundary transition is 100% invisible
  const featherX = Math.max(4, padX);
  const featherY = Math.max(4, padY);

  for (let y = 0; y < rh; y++) {
    const distY = Math.min(y, rh - 1 - y);
    const edgeFactorY = Math.min(1, distY / featherY);
    for (let x = 0; x < rw; x++) {
      const distX = Math.min(x, rw - 1 - x);
      const edgeFactorX = Math.min(1, distX / featherX);
      const borderAlpha = edgeFactorX * edgeFactorY;

      const pIdx = y * rw + x;
      const d = dilatedDiff[pIdx];

      // Smoothly blend inpainted background wherever glyph/halo is detected, plus gentle interior smoothing
      const glyphAlpha = Math.min(1, Math.max(0.25, (d - 10) / 26));
      const alpha = borderAlpha * glyphAlpha;

      const oIdx = pIdx * 4;
      data[oIdx] = Math.round(orig[oIdx] * (1 - alpha) + bgBuffer[pIdx * 3] * alpha);
      data[oIdx + 1] = Math.round(
        orig[oIdx + 1] * (1 - alpha) + bgBuffer[pIdx * 3 + 1] * alpha
      );
      data[oIdx + 2] = Math.round(
        orig[oIdx + 2] * (1 - alpha) + bgBuffer[pIdx * 3 + 2] * alpha
      );
    }
  }

  ctx.putImageData(imgData, rx, ry);

  const avgBgLuminance = bgLumSum / (rw * rh);

  // Extract true glyph color from the top-contrast pixels inside the original text
  let sampledTextColor = avgBgLuminance > 0.55 ? '#0F172A' : '#FFFFFF';
  if (glyphSamples.length >= 6) {
    glyphSamples.sort((a, b) => b.diff - a.diff);
    const topCount = Math.max(4, Math.floor(glyphSamples.length * 0.35));
    let sr = 0,
      sg = 0,
      sb = 0;
    for (let i = 0; i < topCount; i++) {
      sr += glyphSamples[i].r;
      sg += glyphSamples[i].g;
      sb += glyphSamples[i].b;
    }
    const rHex = Math.round(sr / topCount)
      .toString(16)
      .padStart(2, '0');
    const gHex = Math.round(sg / topCount)
      .toString(16)
      .padStart(2, '0');
    const bHex = Math.round(sb / topCount)
      .toString(16)
      .padStart(2, '0');
    sampledTextColor = `#${rHex}${gHex}${bHex}`;
  }

  return { sampledTextColor, avgBgLuminance };
}

/**
 * Renders text edits on top of a user-uploaded image using seamless pixel-level
 * glyph inpainting (transparent background) and matched Arabic/English font families.
 */
export async function renderUploadedImageWithTextEdits(
  sourceImageUrl: string,
  texts: DetectedTextItem[],
  erasedIds: number[] = [],
  options?: {
    enhanced?: boolean;
    customBgColor?: string | null;
    forceRenderModified?: boolean;
  }
): Promise<string> {
  // Wait for Google Fonts to be ready so Canvas draws with the exact matched font family
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue if fonts API is unavailable
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const W = img.naturalWidth || 900;
      const H = img.naturalHeight || 1200;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(sourceImageUrl);
        return;
      }

      if (options?.customBgColor) {
        ctx.fillStyle = options.customBgColor;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 0.88;
        ctx.drawImage(img, 0, 0, W, H);
        ctx.globalAlpha = 1.0;
      } else {
        ctx.drawImage(img, 0, 0, W, H);
      }

      const erasedSet = new Set(erasedIds);

      texts.forEach((item, index) => {
        const baseText = item.initialText ?? item.originalText;
        const isModified =
          item.text.trim() !== baseText.trim() ||
          item.text.trim() !== item.originalText.trim();
        const isErased = erasedSet.has(item.id);
        if (!isModified && !isErased && !options?.forceRenderModified) return;

        // Infer fallback region from position string if no explicit box
        const pos = item.position.toLowerCase();
        let fallbackY = 14 + index * 15;
        if (pos.includes('top')) fallbackY = 10 + index * 10;
        else if (pos.includes('bottom')) fallbackY = 74 + (index % 2) * 10;
        else if (pos.includes('center') || pos.includes('middle'))
          fallbackY = 40 + (index % 2) * 12;

        let fallbackX = 12;
        let fallbackW = 76;
        if (pos.includes('right')) {
          fallbackX = 34;
          fallbackW = 58;
        } else if (pos.includes('left')) {
          fallbackX = 8;
          fallbackW = 58;
        }

        let normX = fallbackX;
        let normY = fallbackY;
        let normW = fallbackW;
        let normH = 12;

        if (item.box) {
          const maxRaw = Math.max(
            item.box.x,
            item.box.y,
            item.box.width,
            item.box.height
          );
          const scaleDiv = maxRaw > 100 ? 10 : maxRaw <= 1 ? 0.01 : 1;
          normX = item.box.x / scaleDiv;
          normY = item.box.y / scaleDiv;
          normW = item.box.width / scaleDiv;
          normH = item.box.height / scaleDiv;

          if (normX >= 92 && normW >= 50) {
            normX = fallbackX;
            normW = fallbackW;
          }
          if (normY >= 92 && normH >= 25) {
            normY = fallbackY;
            normH = 14;
          }
        }

        normX = Math.max(1, Math.min(92, normX));
        normY = Math.max(1, Math.min(92, normY));
        normW = Math.max(4, Math.min(98 - normX, normW));
        normH = Math.max(2.5, Math.min(98 - normY, normH));

        const bx = (normX / 100) * W;
        const by = (normY / 100) * H;
        const bw = (normW / 100) * W;
        const bh = (normH / 100) * H;

        // 1. Seamlessly erase original text glyphs without any solid rectangular background
        const { sampledTextColor, avgBgLuminance } =
          inpaintTextGlyphsSeamlessly(ctx, W, H, bx, by, bw, bh);

        // 2. Render new text with 100% transparent background and matched font family/weight/color
        if (!isErased && item.text.trim()) {
          const styleKey = (
            item.box?.fontStyle && item.box.fontStyle in FONT_STYLE_OPTIONS
              ? item.box.fontStyle
              : 'times_new_roman'
          ) as FontStyleType;
          const fontSpec = FONT_STYLE_OPTIONS[styleKey];
          const fontWeight = item.box?.fontWeight || fontSpec.defaultWeight;
          const isItalic = Boolean(item.box?.fontItalic);
          const fgColor = sampledTextColor || item.box?.color || '#FFFFFF';

          ctx.save();
          ctx.direction = 'rtl';
          ctx.fillStyle = fgColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const rawLines = item.text
            .trim()
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);

          const maxTextWidth = Math.max(36, bw * 1.06);
          let fontSize = Math.max(
            13,
            Math.min(
              Math.round((bh / Math.max(1, rawLines.length)) * 0.82),
              Math.round(W * 0.09)
            )
          );

          const italicPrefix = isItalic ? 'italic ' : '';

          // Auto-fit font size so replacement text matches original box height & width
          let wrappedLines: string[] = [];
          for (let attempt = 0; attempt < 7; attempt++) {
            ctx.font = `${italicPrefix}${fontWeight} ${fontSize}px ${fontSpec.cssFamily}`;
            wrappedLines = [];
            for (const line of rawLines) {
              if (ctx.measureText(line).width <= maxTextWidth) {
                wrappedLines.push(line);
              } else {
                const words = line.split(/\s+/);
                let currentLine = '';
                for (const word of words) {
                  const testLine = currentLine
                    ? `${currentLine} ${word}`
                    : word;
                  if (ctx.measureText(testLine).width <= maxTextWidth) {
                    currentLine = testLine;
                  } else {
                    if (currentLine) wrappedLines.push(currentLine);
                    currentLine = word;
                  }
                }
                if (currentLine) wrappedLines.push(currentLine);
              }
            }
            const totalHeight = wrappedLines.length * (fontSize * 1.22);
            if (totalHeight <= bh * 1.18 || fontSize <= 13) {
              break;
            }
            fontSize = Math.max(13, Math.floor(fontSize * 0.86));
          }

          if (item.box?.hasShadow || options?.enhanced) {
            ctx.shadowColor =
              avgBgLuminance > 0.6
                ? 'rgba(0,0,0,0.22)'
                : 'rgba(0,0,0,0.45)';
            ctx.shadowBlur = Math.max(3, Math.round(fontSize * 0.14));
            ctx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.05));
          }

          const lineHeight = fontSize * 1.22;
          const totalBlockH = wrappedLines.length * lineHeight;
          const startY = by + bh / 2 - totalBlockH / 2 + lineHeight / 2;

          const numericWeight = Number(fontWeight) || 700;

          wrappedLines.forEach((lineStr, lineIdx) => {
            const drawY = startY + lineIdx * lineHeight;
            if (item.box?.strokeColor) {
              ctx.strokeStyle = item.box.strokeColor;
              ctx.lineWidth = Math.max(1.5, fontSize * 0.06);
              ctx.strokeText(lineStr, bx + bw / 2, drawY, maxTextWidth);
            } else if (
              styleKey === 'times_new_roman' &&
              (numericWeight === 500 ||
                numericWeight === 600 ||
                numericWeight === 800 ||
                numericWeight === 900)
            ) {
              // Precision synthetic weight gradation for Times New Roman intermediate/heavy weights
              ctx.strokeStyle = fgColor;
              ctx.lineWidth =
                numericWeight === 500
                  ? Math.max(0.3, fontSize * 0.012)
                  : numericWeight === 600
                  ? Math.max(0.5, fontSize * 0.022)
                  : numericWeight === 800
                  ? Math.max(0.8, fontSize * 0.035)
                  : Math.max(1.2, fontSize * 0.052);
              ctx.strokeText(lineStr, bx + bw / 2, drawY, maxTextWidth);
            }
            ctx.fillText(lineStr, bx + bw / 2, drawY, maxTextWidth);
          });

          ctx.restore();
        }
      });

      resolve(canvas.toDataURL('image/png', 1.0));
    };
    img.onerror = () => resolve(sourceImageUrl);
    img.src = sourceImageUrl;
  });
}
