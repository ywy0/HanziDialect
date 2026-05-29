"""Generate Cantonese TTS audio using Edge TTS neural voice (zh-HK)."""
import json, os, sys, base64, subprocess, asyncio

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)

sys.stdout.reconfigure(encoding="utf-8")

VOICE = "zh-HK-HiuMaanNeural"

async def generate_one(syl, ch, sem):
    """Generate Opus audio for one character via Edge TTS."""
    from edge_tts import Communicate
    from edge_tts.exceptions import NoAudioReceived
    async with sem:
        try:
            communicate = Communicate(ch, VOICE)
            mp3_data = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    mp3_data += chunk["data"]

            if len(mp3_data) < 500:
                return syl, None

            # Convert MP3 to Opus via ffmpeg
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y", "-i", "pipe:0",
                "-c:a", "libopus", "-b:a", "16k",
                "-f", "opus", "pipe:1",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            stdout, _ = await proc.communicate(mp3_data)

            if proc.returncode == 0 and len(stdout) > 100:
                return syl, base64.b64encode(stdout).decode("ascii")
            return syl, None
        except NoAudioReceived:
            return syl, None
        except Exception:
            return syl, None

async def main():
    with open("readings.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    # Step 1: Extract unique syllables + representative character
    # Only use CJK Unified Ideographs basic block (U+4E00-U+9FFF) — common chars that Edge TTS can pronounce
    def is_common(ch):
        cp = ord(ch)
        return 0x4E00 <= cp <= 0x9FFF
    syl_to_char = {}
    for ch, vals in data.items():
        if "yue" in vals and "cmn" in vals and is_common(ch):
            full = vals["yue"].split(",")[0].strip().rstrip("*")
            if full and full not in syl_to_char:
                syl_to_char[full] = ch
    for ch, vals in data.items():
        if "yue" in vals and is_common(ch):
            full = vals["yue"].split(",")[0].strip().rstrip("*")
            if full and full not in syl_to_char:
                syl_to_char[full] = ch

    print(f"Total unique yue syllables: {len(syl_to_char)}")

    # Step 2: Generate audio in parallel
    sem = asyncio.Semaphore(10)  # limit concurrent requests
    result = {}
    n_done = 0
    n_total = len(syl_to_char)

    tasks = [generate_one(syl, ch, sem) for syl, ch in syl_to_char.items()]
    for coro in asyncio.as_completed(tasks):
        syl, b64 = await coro
        if b64:
            result[syl] = b64
        n_done += 1
        if n_done % 100 == 0:
            pct = n_done * 100 // n_total
            print(f"  {n_done}/{n_total} ({pct}%) ok:{len(result)}", flush=True)

    print(f"Generated: {len(result)}/{n_total}")
    total_kb = sum(len(v) for v in result.values()) / 1024
    print(f"Size: {total_kb:.0f} KB base64")

    # Step 3: Merge with existing hak audio
    existing = {}
    tts_path = "tts_audio.js"
    if os.path.exists(tts_path):
        js = open(tts_path, "r", encoding="utf-8").read()
        start = js.index("{")
        end = js.rindex("}") + 1
        existing = json.loads(js[start:end])

    existing["yue"] = result

    # Step 4: Save
    with open(tts_path, "w", encoding="utf-8") as f:
        f.write("var TTS_AUDIO = ")
        json.dump(existing, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";")

    fsize = os.path.getsize(tts_path)
    print(f"Saved {tts_path}: {fsize/1024:.0f} KB")

if __name__ == "__main__":
    asyncio.run(main())
