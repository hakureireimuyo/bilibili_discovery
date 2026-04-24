/**
 * 图像处理工具函数
 * 支持不同尺寸的图像压缩
 */

import { ImagePurpose } from '../database/types/image.js';

/**
 * 根据用途获取目标尺寸
 */
function getTargetSize(purpose: ImagePurpose): { width: number; height: number } {
  switch (purpose) {
    case ImagePurpose.AVATAR:
      return { width: 150, height: 150 };
    case ImagePurpose.COVER:
      return { width: 640, height: 360 };
    default:
      return { width: 640, height: 360 };
  }
}

/**
 * 获取图片尺寸
 */
async function getImageSize(src: string): Promise<{ width: number; height: number }> {
  console.log("[ImageUtils] Getting image size...");

  // 在没有DOM的环境中（如service worker），跳过尺寸检查
  if (typeof Image === 'undefined') {
    console.log("[ImageUtils] Image API not available, skipping size check");
    return { width: 0, height: 0 };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    // 只有当src是URL时才设置crossOrigin，DataURL不需要
    if (!src.startsWith('data:')) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      console.log(`[ImageUtils] Image loaded for size check, size: ${img.width}x${img.height}`);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = (err) => {
      console.warn("[ImageUtils] Failed to load image for size check:", err);
      // 加载失败时返回默认尺寸，避免阻塞压缩流程
      resolve({ width: 0, height: 0 });
    };
    img.src = src;
  });
}

/**
 * 压缩图像到指定尺寸（cover 模式）
 * @param src - 图像源（DataURL或URL）
 * @param purpose - 图像用途
 * @returns Promise<Blob> - 压缩后的图像Blob
 */
export async function compressImage(src: string, purpose: ImagePurpose): Promise<Blob> {
  console.log(`[ImageUtils] Starting compression for purpose: ${purpose}...`);

  // 在没有DOM的环境中（如service worker），跳过压缩
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    console.log("[ImageUtils] DOM APIs not available, skipping compression");
    // 将DataURL转换为Blob并返回
    return dataUrlToBlob(src);
  }

  const { width: targetWidth, height: targetHeight } = getTargetSize(purpose);

  return new Promise((resolve, reject) => {
    const img = new Image();
    // 只有当src是URL时才设置crossOrigin，DataURL不需要
    if (!src.startsWith('data:')) {
      img.crossOrigin = "anonymous";
    }
    console.log("[ImageUtils] Loading image...");

    img.onload = () => {
      console.log(`[ImageUtils] Image loaded successfully, size: ${img.width}x${img.height}`);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Failed to get canvas context");
        }

        // 计算 cover 缩放比例（保证填满）
        const scale = Math.max(
          targetWidth / img.width,
          targetHeight / img.height
        );

        const newWidth = img.width * scale;
        const newHeight = img.height * scale;

        // 居中裁剪
        const dx = (targetWidth - newWidth) / 2;
        const dy = (targetHeight - newHeight) / 2;

        ctx.drawImage(img, dx, dy, newWidth, newHeight);

        // 转换为Blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(
                `[ImageUtils] Compression completed, original size: ${img.width}x${img.height}, ` +
                `compressed to: ${targetWidth}x${targetHeight}, blob size: ${blob.size} bytes`
              );
              resolve(blob);
            } else {
              reject(new Error("Failed to create blob from canvas"));
            }
          },
          "image/jpeg",
          0.7
        );
      } catch (error) {
        console.error("[ImageUtils] Error during compression:", error);
        reject(error);
      }
    };

    img.onerror = (err) => {
      console.error("[ImageUtils] Failed to load image:", err);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = src;
  });
}

/**
 * 判断是否需要压缩
 * @param src - 图像源（DataURL或URL）
 * @param purpose - 图像用途
 * @returns Promise<boolean> - 是否需要压缩
 */
export async function shouldCompress(src: string, purpose: ImagePurpose): Promise<boolean> {
  console.log(`[ImageUtils] Checking if image needs compression for purpose: ${purpose}...`);

  // 在没有DOM的环境中（如service worker），跳过压缩检查
  if (typeof Image === 'undefined') {
    console.log("[ImageUtils] Image API not available, skipping compression check");
    return false;
  }

  const { width: targetWidth, height: targetHeight } = getTargetSize(purpose);
  const { width, height } = await getImageSize(src);
  const needsCompress = width > targetWidth || height > targetHeight;
  console.log(
    `[ImageUtils] Image size: ${width}x${height}, Target: ${targetWidth}x${targetHeight}, ` +
    `Needs compression: ${needsCompress}`
  );
  return needsCompress;
}

/**
 * 将DataURL转换为Blob
 * @param dataUrl - DataURL字符串
 * @returns Promise<Blob> - Blob对象
 */
export function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    resolve(blob);
  });
}

/**
 * 将Blob转换为DataURL
 * @param blob - Blob对象
 * @returns Promise<string> - DataURL字符串
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to convert blob to data URL"));
    reader.readAsDataURL(blob);
  });
}
