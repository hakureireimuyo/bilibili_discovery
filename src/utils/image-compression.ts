const TARGET_WIDTH = 640;
const TARGET_HEIGHT = 360;

/**
 * 获取图片尺寸
 */
async function getImageSize(src: string): Promise<{ width: number; height: number }> {
  console.log("[ImageCompression] Getting image size...");
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      console.log(`[ImageCompression] Image loaded for size check, size: ${img.width}x${img.height}`);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = (err) => {
      console.warn("[ImageCompression] Failed to load image for size check:", err);
      // 加载失败时返回默认尺寸，避免阻塞压缩流程
      resolve({ width: 0, height: 0 });
    };
    img.src = src;
  });
}

/**
 * 压缩并裁剪为 640×360（cover 模式）
 */
export async function compressToTarget(src: string): Promise<string> {
  console.log("[ImageCompression] Starting compression process...");
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    console.log("[ImageCompression] Loading image...");
    img.onload = () => {
      console.log(`[ImageCompression] Image loaded successfully, size: ${img.width}x${img.height}`);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Failed to get canvas context");
        }
      
      // 计算 cover 缩放比例（保证填满）
      const scale = Math.max(
        TARGET_WIDTH / img.width,
        TARGET_HEIGHT / img.height
      );

      const newWidth = img.width * scale;
      const newHeight = img.height * scale;

      // 居中裁剪
      const dx = (TARGET_WIDTH - newWidth) / 2;
      const dy = (TARGET_HEIGHT - newHeight) / 2;

      ctx.drawImage(img, dx, dy, newWidth, newHeight);

        const result = canvas.toDataURL("image/jpeg", 0.7);
        console.log("[ImageCompression] Compression completed, original size:", 
                    `${img.width}x${img.height}, compressed to: ${TARGET_WIDTH}x${TARGET_HEIGHT}`);
        resolve(result);
      } catch (error) {
        console.error("[ImageCompression] Error during compression:", error);
        reject(error);
      }
    };
    img.onerror = (err) => {
      console.error("[ImageCompression] Failed to load image:", err);
      reject(new Error("Failed to load image for compression"));
    };
    img.src = src;
  });
}

/**
 * 判断是否需要压缩
 */
export async function shouldCompress(src: string): Promise<boolean> {
  console.log("[ImageCompression] Checking if image needs compression...");
  const { width, height } = await getImageSize(src);
  const needsCompress = width > TARGET_WIDTH || height > TARGET_HEIGHT;
  console.log(`[ImageCompression] Image size: ${width}x${height}, Target: ${TARGET_WIDTH}x${TARGET_HEIGHT}, Needs compression: ${needsCompress}`);
  return needsCompress;
}