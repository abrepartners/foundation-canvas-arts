import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// Stitch 6 MP4 clip URLs into a single MP4 using ffmpeg.wasm. Returns the final Blob.
// onProgress receives a fraction in 0..1.
export async function stitchClips(
  clipUrls: string[],
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const ffmpeg = new FFmpeg();
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpeg.on("progress", ({ progress }) => {
    if (onProgress) onProgress(Math.min(Math.max(progress, 0), 1));
  });

  // Download each clip and write to ffmpeg's virtual FS.
  const fileList: string[] = [];
  for (let i = 0; i < clipUrls.length; i++) {
    const name = `c${i}.mp4`;
    const data = await fetchFile(clipUrls[i]);
    await ffmpeg.writeFile(name, data);
    fileList.push(`file '${name}'`);
  }
  await ffmpeg.writeFile("list.txt", new TextEncoder().encode(fileList.join("\n")));

  // Try concat demuxer first (fast, no re-encode).
  let usedReencode = false;
  try {
    await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "out.mp4"]);
  } catch {
    // Fallback: re-encode (different codecs/resolutions).
    usedReencode = true;
    const inputs: string[] = [];
    for (let i = 0; i < clipUrls.length; i++) {
      inputs.push("-i", `c${i}.mp4`);
    }
    const filterParts: string[] = [];
    for (let i = 0; i < clipUrls.length; i++) {
      filterParts.push(`[${i}:v:0][${i}:a:0?]`);
    }
    const filter = `${filterParts.join("")}concat=n=${clipUrls.length}:v=1:a=${clipUrls.some(Boolean) ? 1 : 0}[v][a]`;
    await ffmpeg.exec([
      ...inputs,
      "-filter_complex",
      filter,
      "-map",
      "[v]",
      "-map",
      "[a]?",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "out.mp4",
    ]);
  }

  const data = (await ffmpeg.readFile("out.mp4")) as Uint8Array;
  const buf = new Uint8Array(data.byteLength);
  buf.set(data);
  const blob = new Blob([buf], { type: "video/mp4" });
  void usedReencode;
  return blob;
}
