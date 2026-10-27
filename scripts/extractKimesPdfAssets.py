"""KIMES 2026 스폰서십 PDF → 사이트용 이미지 추출 (seedKimes2026.mjs 입력).

사용: python -I scripts/extractKimesPdfAssets.py <국문.pdf> <영문.pdf> <출력폴더>

출력(assets/):
  hero/<name>.webp      상품 페이지 오른쪽 예시 사진 (페이지 좌표 1082,304 ~ 1823,969),
                        좌우 여백을 붙여 2:1 — 사이트 사진 틀이 object-cover 라
                        4:3(데스크톱)~2:1(모바일) 어느 틀에서도 사진이 잘리지 않게
  floor/<name>.webp     부록 위치 도면 (흰 모달 박스, 닫기 X 지움, 4:3 패딩)
  landing/<lang>_pNN.webp  소개 슬라이드 렌더 (1920x1080), LANDING_TEXT 의 문구만 교체
  manifest.json         파일 목록 + 도면 핀 좌표(%)
"""
import json, os, sys
import fitz
from PIL import Image, ImageDraw, ImageFont, ImageStat

KO = sys.argv[1]
EN = sys.argv[2]
OUT = sys.argv[3]

HERO_PAGES = {
    14: "xpace_bridge", 15: "xpace_wide", 16: "xpace_edge", 17: "ceiling",
    18: "regdesk", 19: "lanyard", 20: "dm", 21: "guide_c4", 22: "guide_c2",
    23: "guide_c3", 24: "led", 25: "floor_sticker", 26: "lighting_wall",
    27: "rgs", 28: "rgm", 29: "tts", 30: "prs", 31: "exs", 32: "smr",
    33: "fps", 34: "fpl", 35: "dnl", 36: "inl", 38: "app_push",
    39: "app_popup", 40: "app_bottom", 41: "interview", 42: "cardnews",
}
HERO_CLIP = fitz.Rect(1082, 304, 1823, 969)

FLOOR_PAGES = {
    45: "xpace_bridge", 46: "xpace_wide", 47: "xpace_edge", 48: "ceiling",
    49: "regdesk", 50: "lighting_wall", 51: "led",
}
FLOOR_BOX = fitz.Rect(92, 102, 1839, 989)
CLOSE_X = (1725, 130, 1800, 205)  # 페이지 좌표, 모달 닫기 아이콘

LANDING_PAGES = [1, 3, 4, 5, 6, 7]
# KIMES 2027 판매용 — 신청 절차 슬라이드의 입금 마감 연도 교체 (월일은 2026 과 같게 가정)
LANDING_TEXT = {
    ("ko", 7): [("2026년 2월 28일(토)", "2027년 2월 28일(일)")],
    ("en", 7): [("February 28, 2026 (Sat)", "February 28, 2027 (Sun)")],
}
TEXT_FONT = os.path.join(os.environ["LOCALAPPDATA"], "Microsoft", "Windows", "Fonts", "NotoSansKR-Regular.otf")

HERO_ASPECT = 2.0
HERO_PAD = (235, 235, 235)  # 사이트 사진 틀 배경 ink-100 (#EBEBEB)


def to_pil(pix):
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def pad_to_aspect(img, aspect):
    """좌우 여백으로 가로세로비 맞춤. 가장자리가 단색(목업 배경)이면 그 색, 사진이면 틀 배경색."""
    W = round(img.height * aspect)
    if W <= img.width:
        return img
    edges = [img.crop((0, 0, 4, img.height)), img.crop((img.width - 4, 0, img.width, img.height))]
    stats = [ImageStat.Stat(e) for e in edges]
    flat = all(max(s.stddev) < 6 for s in stats)
    fill = tuple(round(sum(s.mean[c] for s in stats) / 2) for c in range(3)) if flat else HERO_PAD
    canvas = Image.new("RGB", (W, img.height), fill)
    canvas.paste(img, ((W - img.width) // 2, 0))
    return canvas


def replace_text(page, img, zoom, pairs):
    """렌더된 슬라이드에서 문구 자리를 배경색으로 지우고 같은 기준선·크기로 새 문구를 그림."""
    draw = ImageDraw.Draw(img)
    spans = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]]
    for old, new in pairs:
        span = next(s for s in spans if s["text"].strip() == old)
        x0, y0, x1, y1 = (v * zoom for v in span["bbox"])
        box = (x0 - 2, y0 - 2, x1 + 2 * zoom, y1 + 2)
        region = img.crop(tuple(round(v) for v in box))
        bg = max(region.getcolors(region.width * region.height), key=lambda c: c[0])[1]
        ink = min(region.convert("RGB").get_flattened_data(), key=sum)
        draw.rectangle(box, fill=bg)
        font = ImageFont.truetype(TEXT_FONT, round(span["size"] * zoom))
        ox, oy = (v * zoom for v in span["origin"])
        draw.text((ox, oy), new, font=font, fill=ink, anchor="ls")


def save_webp(img, path, max_dim=1920, quality=84):
    if max(img.size) > max_dim:
        r = max_dim / max(img.size)
        img = img.resize((round(img.width * r), round(img.height * r)), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "WEBP", quality=quality, method=6)
    return img.size


manifest = {"hero": {}, "floor": {}, "landing": {"ko": [], "en": []}}
ko = fitz.open(KO)
en = fitz.open(EN)

for pn, name in HERO_PAGES.items():
    pix = ko[pn - 1].get_pixmap(matrix=fitz.Matrix(2, 2), clip=HERO_CLIP)
    size = save_webp(pad_to_aspect(to_pil(pix), HERO_ASPECT), f"{OUT}/hero/{name}.webp")
    manifest["hero"][name] = {"file": f"hero/{name}.webp", "page": pn, "size": size}

for pn, name in FLOOR_PAGES.items():
    page = ko[pn - 1]
    z = 1.5
    img = to_pil(page.get_pixmap(matrix=fitz.Matrix(z, z), clip=FLOOR_BOX))
    x0, y0, x1, y1 = CLOSE_X
    ImageDraw.Draw(img).rectangle(
        [(x0 - FLOOR_BOX.x0) * z, (y0 - FLOOR_BOX.y0) * z,
         (x1 - FLOOR_BOX.x0) * z, (y1 - FLOOR_BOX.y0) * z],
        fill="white",
    )
    # 4:3 으로 위아래 흰 여백 — 사이트 도면 박스가 aspect-[4/3] object-contain 이라
    # 핀 % 좌표가 이미지 좌표와 그대로 맞도록.
    W = img.width
    H = round(W * 3 / 4)
    pad = (H - img.height) // 2
    canvas = Image.new("RGB", (W, H), "white")
    canvas.paste(img, (0, pad))

    def pct(cx, cy):
        return (
            round((cx - FLOOR_BOX.x0) * z / W * 100, 2),
            round(((cy - FLOOR_BOX.y0) * z + pad) / H * 100, 2),
        )

    labels = {}
    for w in page.get_text("words"):
        cx, cy = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
        if FLOOR_BOX.contains(fitz.Point(cx, cy)):
            labels[w[4]] = pct(cx, cy)
    size = save_webp(canvas, f"{OUT}/floor/{name}.webp")
    manifest["floor"][name] = {"file": f"floor/{name}.webp", "page": pn, "size": size, "labels": labels}

for lang, doc in (("ko", ko), ("en", en)):
    for pn in LANDING_PAGES:
        page = doc[pn - 1]
        z = 2  # 문구 교체를 고해상도에서 하고 1920 으로 축소
        img = to_pil(page.get_pixmap(matrix=fitz.Matrix(z, z)))
        if (lang, pn) in LANDING_TEXT:
            replace_text(page, img, z, LANDING_TEXT[(lang, pn)])
        save_webp(img, f"{OUT}/landing/{lang}_p{pn:02d}.webp", quality=88)
        manifest["landing"][lang].append(f"landing/{lang}_p{pn:02d}.webp")

with open(f"{OUT}/manifest.json", "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
print("hero", len(manifest["hero"]), "floor", len(manifest["floor"]),
      "landing", {k: len(v) for k, v in manifest["landing"].items()})
