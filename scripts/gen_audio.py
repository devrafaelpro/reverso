"""Gera os áudios dos nomes com vozes neurais pt-BR (edge-tts, grátis) e o arquivo js/names.js.

Uso:  py -m pip install edge-tts   &&   py scripts/gen_audio.py
Só gera os áudios que ainda não existem (use --force para refazer tudo).
"""
import asyncio, json, os, re, sys, unicodedata

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "names.json")
OUT_AUDIO = os.path.join(ROOT, "audio")
OUT_JS = os.path.join(ROOT, "js", "names.js")
# Só vozes brasileiras: a Thalita "multilíngue" puxava sotaque inglês nos nomes.
# Cada nome pode fixar a voz com "v": "A" (Antonio) ou "F" (Francisca), escolhida pela que o Whisper entende melhor.
VOICES = {"A": "pt-BR-AntonioNeural", "F": "pt-BR-FranciscaNeural"}


def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


async def gen(item, voice, force):
    path = os.path.join(OUT_AUDIO, item["id"] + ".mp3")
    if os.path.exists(path) and not force:
        return
    text = item.get("s") or item["n"]
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, voice, rate="-12%").save(path)
            print("ok ", item["id"], voice)
            return
        except Exception as e:  # rede instável: tenta de novo
            print("retry", item["id"], e)
            await asyncio.sleep(1 + attempt)
    raise RuntimeError("falhou: " + item["id"])


async def main():
    force = "--force" in sys.argv
    os.makedirs(OUT_AUDIO, exist_ok=True)
    items, seen = [], set()
    for it in json.load(open(DATA, encoding="utf-8")):
        it["id"] = slug(it["n"])
        if it["id"] in seen:
            continue
        seen.add(it["id"])
        items.append(it)

    sem = asyncio.Semaphore(6)

    async def run(i, it):
        async with sem:
            await gen(it, VOICES[it.get("v") or "AF"[i % 2]], force)

    await asyncio.gather(*(run(i, it) for i, it in enumerate(items)))

    out = [{"id": it["id"], "n": it["n"], "c": it["c"], "a": it.get("a", [])} for it in items]
    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write("// Gerado por scripts/gen_audio.py — não edite à mão.\n")
        f.write("export const NAMES = " + json.dumps(out, ensure_ascii=False).replace("}, {", "},\n{") + ";\n")
    print(len(out), "nomes")


asyncio.run(main())
