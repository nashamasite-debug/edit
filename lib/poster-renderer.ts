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
        const isModified = item.text !== item.originalText;
        const isErased = erasedSet.has(item.id);
        if (!isModified && !isErased) return;

        // Infer region from position string if no explicit box
        const pos = item.position.toLowerCase();
        let yPct = 14 + index * 15;
        if (pos.includes('top')) yPct = 10 + index * 10;
        else if (pos.includes('bottom')) yPct = 76 + (index % 2) * 10;
        else if (pos.includes('center') || pos.includes('middle'))
          yPct = 42 + (index % 2) * 12;

        let xPct = 12;
        let widthPct = 76;
        if (pos.includes('right')) {
          xPct = 36;
          widthPct = 56;
        } else if (pos.includes('left')) {
          xPct = 8;
          widthPct = 56;
        }

        const box = item.box || {
          x: xPct,
          y: yPct,
          width: widthPct,
          height: 9,
        };

        const bx = (box.x / 100) * W;
        const by = (box.y / 100) * H;
        const bw = (box.width / 100) * W;
        const bh = (box.height / 100) * H;

        // Sample multiple surrounding border pixels for accurate background patch
        const samplePoints = [
          [Math.max(0, bx - 3), Math.max(0, by + bh / 2)],
          [Math.min(W - 1, bx + bw + 3), Math.max(0, by + bh / 2)],
          [Math.max(0, bx + bw / 2), Math.max(0, by - 3)],
          [Math.max(0, bx + bw / 2), Math.min(H - 1, by + bh + 3)],
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
        const bgFill = box.bgColor || `rgb(${rAvg}, ${gAvg}, ${bAvg})`;
        const luminance = (0.299 * rAvg + 0.587 * gAvg + 0.114 * bAvg) / 255;
        const fgColor =
          box.color || (luminance > 0.55 ? '#0F172A' : '#FFFFFF');

        ctx.save();
        ctx.fillStyle = bgFill;
        ctx.beginPath();
        ctx.roundRect(bx - 4, by - 3, bw + 8, bh + 6, 8);
        ctx.fill();

        if (!isErased && item.text.trim()) {
          ctx.direction = 'rtl';
          const fitSizeByHeight = Math.round(bh * 0.68);
          const defaultSize = Math.round(
            W * (item.label === 'headline' ? 0.042 : 0.026)
          );
          const fontSize = Math.max(
            14,
            Math.min(fitSizeByHeight || defaultSize, Math.round(W * 0.08))
          );
          ctx.font = `700 ${fontSize}px Cairo, "IBM Plex Sans Arabic", sans-serif`;
          ctx.fillStyle = fgColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (options?.enhanced) {
            ctx.shadowColor = 'rgba(0,0,0,0.28)';
            ctx.shadowBlur = 6;
          }
          ctx.fillText(item.text, bx + bw / 2, by + bh / 2, Math.max(40, bw - 8));
        }
        ctx.restore();
      });

      resolve(canvas.toDataURL('image/png', 1.0));
    };
    img.onerror = () => resolve(sourceImageUrl);
    img.src = sourceImageUrl;
  });
}
