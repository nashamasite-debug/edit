export type TextLabelType =
  | 'headline'
  | 'subtitle'
  | 'phone'
  | 'body'
  | 'logo_text'
  | 'badge';

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
    fontWeight?: string;
    align?: 'center' | 'right' | 'left';
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
 * Renders text edits on top of a user-uploaded image using smart region inpainting
 * and crisp RTL Arabic typography.
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

          // Guard against legacy clamped 95% values
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
        normW = Math.max(8, Math.min(98 - normX, normW));
        normH = Math.max(5, Math.min(98 - normY, normH));

        const bx = (normX / 100) * W;
        const by = (normY / 100) * H;
        const bw = (normW / 100) * W;
        const bh = (normH / 100) * H;

        // Sample surrounding border pixels for seamless background patch
        const samplePoints = [
          [Math.max(1, bx - 4), Math.max(1, by + bh * 0.25)],
          [Math.max(1, bx - 4), Math.max(1, by + bh * 0.75)],
          [Math.min(W - 2, bx + bw + 4), Math.max(1, by + bh * 0.25)],
          [Math.min(W - 2, bx + bw + 4), Math.max(1, by + bh * 0.75)],
          [Math.max(1, bx + bw * 0.5), Math.max(1, by - 4)],
          [Math.max(1, bx + bw * 0.5), Math.min(H - 2, by + bh + 4)],
        ];
        let rSum = 0,
          gSum = 0,
          bSum = 0;
        for (const [sx, sy] of samplePoints) {
          const px = ctx.getImageData(
            Math.max(0, Math.min(W - 1, Math.floor(sx))),
            Math.max(0, Math.min(H - 1, Math.floor(sy))),
            1,
            1
          ).data;
          rSum += px[0];
          gSum += px[1];
          bSum += px[2];
        }
        const rAvg = Math.round(rSum / samplePoints.length);
        const gAvg = Math.round(gSum / samplePoints.length);
        const bAvg = Math.round(bSum / samplePoints.length);
        const bgFill = item.box?.bgColor || `rgb(${rAvg}, ${gAvg}, ${bAvg})`;
        const luminance = (0.299 * rAvg + 0.587 * gAvg + 0.114 * bAvg) / 255;
        const fgColor =
          item.box?.color || (luminance > 0.55 ? '#0F172A' : '#FFFFFF');

        const padX = Math.max(6, Math.round(W * 0.008));
        const padY = Math.max(4, Math.round(H * 0.006));

        ctx.save();
        ctx.fillStyle = bgFill;
        ctx.beginPath();
        ctx.roundRect(
          Math.max(0, bx - padX),
          Math.max(0, by - padY),
          Math.min(W, bw + padX * 2),
          Math.min(H, bh + padY * 2),
          8
        );
        ctx.fill();

        if (!isErased && item.text.trim()) {
          ctx.direction = 'rtl';
          ctx.fillStyle = fgColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const rawLines = item.text
            .trim()
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);

          const maxTextWidth = Math.max(40, bw - padX);
          let fontSize = Math.max(
            14,
            Math.min(
              Math.round((bh / Math.max(1, rawLines.length)) * 0.65),
              Math.round(W * 0.075)
            )
          );

          // Wrap lines if needed and auto-shrink font to fit bounding box
          let wrappedLines: string[] = [];
          for (let attempt = 0; attempt < 6; attempt++) {
            ctx.font = `700 ${fontSize}px Cairo, "IBM Plex Sans Arabic", sans-serif`;
            wrappedLines = [];
            for (const line of rawLines) {
              if (ctx.measureText(line).width <= maxTextWidth) {
                wrappedLines.push(line);
              } else {
                const words = line.split(/\s+/);
                let currentLine = '';
                for (const word of words) {
                  const testLine = currentLine ? `${currentLine} ${word}` : word;
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
            const totalHeight = wrappedLines.length * (fontSize * 1.28);
            if (totalHeight <= bh * 1.15 || fontSize <= 14) {
              break;
            }
            fontSize = Math.max(14, Math.floor(fontSize * 0.85));
          }

          if (options?.enhanced) {
            ctx.shadowColor = 'rgba(0,0,0,0.28)';
            ctx.shadowBlur = 6;
          }

          const lineHeight = fontSize * 1.28;
          const totalBlockH = wrappedLines.length * lineHeight;
          const startY = by + bh / 2 - totalBlockH / 2 + lineHeight / 2;

          wrappedLines.forEach((lineStr, lineIdx) => {
            ctx.fillText(
              lineStr,
              bx + bw / 2,
              startY + lineIdx * lineHeight,
              maxTextWidth
            );
          });
        }
        ctx.restore();
      });

      resolve(canvas.toDataURL('image/png', 1.0));
    };
    img.onerror = () => resolve(sourceImageUrl);
    img.src = sourceImageUrl;
  });
}
