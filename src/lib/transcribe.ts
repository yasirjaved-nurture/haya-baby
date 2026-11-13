/** Voice note → text via any OpenAI-compatible Whisper endpoint. Returns null when disabled. */
export async function transcribe(buffer: ArrayBuffer, mime: string): Promise<string | null> {
  const key = process.env.TRANSCRIBE_API_KEY;
  if (!key) return null;
  const base = process.env.TRANSCRIBE_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.TRANSCRIBE_MODEL || "whisper-1";
  const cleanMime = mime.split(";")[0].trim() || "audio/ogg";
  const ext = cleanMime.split("/")[1]?.replace("mpeg", "mp3") || "ogg";

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: cleanMime }), `voice.${ext}`);
  form.append("model", model);
  form.append(
    "prompt",
    "Baby shop stock update. Romper, starter set, swaddle, blanket, onesie, 0-3 months, sold, stock, khatam, bik gaye, aa gaye, price.",
  );

  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
  const json = await res.json();
  return (json.text as string)?.trim() || null;
}
