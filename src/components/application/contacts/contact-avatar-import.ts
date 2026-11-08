import { isContactAvatarDataUrl } from "@/app/contact-avatar";

export const CONTACT_AVATAR_ACCEPT = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Decode and crop locally; only the resized raster enters the contact draft. */
export async function importContactAvatar(file: File, signal: AbortSignal): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("请选择 PNG、JPG 或 WebP 图片。");
  if (!file.size) throw new Error("图片文件为空，请重新选择。");
  if (file.size > MAX_FILE_BYTES) throw new Error("图片不能超过 5 MB，请选择较小的图片。");
  signal.throwIfAborted();
  const picture = new Image();
  const reader = new FileReader();
  let abort: (() => void) | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      abort = () => {
        reader.abort();
        reject(new DOMException("Import cancelled", "AbortError"));
      };
      signal.addEventListener("abort", abort, { once: true });
      picture.onload = () => resolve();
      picture.onerror = () => reject(new Error("无法读取这张图片，请换一张图片重试。"));
      reader.onerror = () => reject(new Error("无法读取图片文件，请重新选择。"));
      reader.onload = () => {
        if (typeof reader.result !== "string") return reject(new Error("无法读取图片文件，请重新选择。"));
        picture.src = reader.result;
      };
      // The desktop CSP permits data images; no blob permission is needed.
      reader.readAsDataURL(file);
    });
    signal.throwIfAborted();
    const { naturalWidth: width, naturalHeight: height } = picture;
    if (!width || !height || width * height > 40_000_000) throw new Error("图片尺寸过大或无效，请选择较小的图片。");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("暂时无法处理图片，请重新选择。");
    const side = Math.min(width, height);
    context.drawImage(picture, (width - side) / 2, (height - side) / 2, side, side, 0, 0, 256, 256);
    const dataUrl = canvas.toDataURL("image/webp", 0.82);
    if (!isContactAvatarDataUrl(dataUrl)) throw new Error("图片处理失败，请换一张图片重试。");
    return dataUrl;
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
    reader.onload = reader.onerror = null;
    if (reader.readyState === FileReader.LOADING) reader.abort();
    picture.onload = picture.onerror = null;
    picture.src = "";
  }
}
