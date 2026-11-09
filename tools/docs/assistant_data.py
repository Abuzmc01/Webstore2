# -*- coding: utf-8 -*-
"""
Data untuk asisten chat website (public/assets/data/assistant-index.json).
Dipanggil otomatis oleh build.py.

- ANSWERS : jawaban cepat untuk pertanyaan umum (harga, pembayaran, lokasi, kontak, dll).
            Ubah teks di sini kalau harga atau info layanan berubah, lalu jalankan build.py.
- Dokumen tutorial diambil otomatis dari content.py.
"""
import html, json, re

WA_SUPPORT = "6282377658840"

# kw: daftar grup kata kunci. Jawaban cocok kalau SEMUA grup punya minimal satu kata yang muncul di pertanyaan.
ANSWERS = [
    {
        "id": "harga",
        "kw": [["harga", "harganya", "biaya", "price", "murah", "tarif", "paket", "plan", "sewa", "budget", "pricelist"]],
        "a": "Paket hosting Minecraft MineIDHost:<br>"
             "<b>Basic</b> (AMD EPYC / Threadripper / Xeon, DDR5):<br>"
             "• 1 GB – Rp10.000/bulan<br>• 2 GB – Rp20.000<br>• 3 GB – Rp30.000<br>• 4 GB – Rp40.000<br>"
             "• 8 GB – Rp80.000<br>• 10 GB – Rp100.000<br>• 16 GB – Rp160.000<br>"
             "<b>Medium</b> (Ryzen 9 9950X / EPYC 4585PX 5.7 GHz) mulai Rp160.000 untuk 8 GB.<br>"
             "Ada juga <b>Private Node</b> untuk server besar.",
        "links": [["Lihat semua paket", "/minecraft-hosting"]],
    },
    {
        "id": "ram",
        "kw": [["ram", "gb", "kuat", "cukup", "rekomendasi", "rekomen", "cocok", "butuh", "berapa"], ["pemain", "player", "orang", "slot", "ram", "gb", "modpack"]],
        "a": "Perkiraan RAM yang dibutuhkan:<br>"
             "• 1–5 pemain vanilla: 1–2 GB<br>• Server plugin 10–20 pemain: 3–4 GB<br>"
             "• 20–50 pemain dengan banyak plugin: 6–8 GB<br>• Modpack ringan: 6–8 GB<br>• Modpack berat (ATM dll): 10 GB ke atas<br>"
             "Jumlah pemain tidak dibatasi, yang membatasi adalah RAM dan CPU.",
        "links": [["Lihat paket", "/minecraft-hosting"], ["Tips optimasi", "/docs/cara-optimasi-server-minecraft"]],
    },
    {
        "id": "bayar",
        "kw": [["bayar", "pembayaran", "payment", "qris", "dana", "gopay", "ovo", "alfamart", "transfer", "metode"]],
        "a": "Pembayaran bisa lewat <b>QRIS, DANA, GoPay, OVO, dan Alfamart</b> di halaman billing saat checkout.",
        "links": [["Buka billing", "https://billing.mineidhost.com"]],
    },
    {
        "id": "order",
        "kw": [["order", "pesan", "beli", "daftar", "checkout", "langganan"]],
        "a": "Cara order:<br>1. Pilih paket di halaman Minecraft Hosting.<br>2. Klik <b>Pesan Sekarang</b>, buat akun billing, lalu checkout.<br>"
             "3. Setelah pembayaran berhasil, server dibuat dan detail login panel dikirim ke akun kamu.",
        "links": [["Pilih paket", "/minecraft-hosting"], ["Cara akses panel", "/docs/cara-akses-panel"]],
    },
    {
        "id": "lokasi",
        "kw": [["lokasi", "location", "region", "singapore", "sg", "malaysia", "indonesia", "ping", "datacenter", "dc"]],
        "a": "Lokasi server: paket <b>Basic</b> di Singapore/Indonesia, paket <b>Medium</b> di Singapore/Malaysia. "
             "Semuanya dekat dengan Indonesia sehingga ping rendah.",
        "links": [["Lihat paket", "/minecraft-hosting"]],
    },
    {
        "id": "panel",
        "kw": [["panel", "login", "masuk"], ["panel", "pterodactyl", "akun", "login"]],
        "a": "Panel server ada di <b>panel.mineidhost.com</b>. Login memakai akun yang dikirim setelah pembayaran.",
        "links": [["Buka panel", "https://panel.mineidhost.com"], ["Panduan panel", "/docs/cara-akses-panel"]],
    },
    {
        "id": "ddos",
        "kw": [["ddos", "attack", "serang", "diserang", "uptime"]],
        "a": "Semua paket sudah termasuk <b>DDoS Protection</b> dengan target uptime 99,9%.",
        "links": [["Lihat paket", "/minecraft-hosting"]],
    },
    {
        "id": "kontak",
        "kw": [["kontak", "contact", "admin", "cs", "whatsapp", "wa", "discord", "email", "hubungi", "support"]],
        "a": "Kamu bisa menghubungi tim MineIDHost lewat:<br>• WhatsApp: +62 823-7765-8840<br>• Discord: dsc.gg/mineidhost<br>• Email: mineidhost@gmail.com<br>"
             "Atau klik <b>Hubungi tim teknis</b> di bawah, pertanyaanmu langsung diteruskan ke grup admin.",
        "links": [["Discord", "https://dsc.gg/mineidhost"]],
        "ticket": True,
    },
    {
        "id": "bedrock",
        "kw": [["bedrock", "hp", "pe", "mcpe", "android", "ios", "crossplay", "geyser", "console", "xbox", "playstation", "switch"]],
        "a": "Bisa. Server Java MineIDHost bisa dimasuki pemain Bedrock (HP, Windows, konsol) dengan <b>GeyserMC + Floodgate</b>. "
             "Setiap paket punya port tambahan untuk Bedrock.",
        "links": [["Setup GeyserMC terbaru", "/docs/cara-setup-geysermc"], ["Crossplay Java & Bedrock", "/docs/crossplay-minecraft-java-bedrock"]],
    },
    {
        "id": "partner",
        "kw": [["partner", "partnership", "kerjasama", "sponsor", "youtuber", "creator"]],
        "a": "MineIDHost punya program partnership untuk server Minecraft dan content creator.",
        "links": [["Program Partnership", "/partners"]],
    },
]

STOP = set("""
a ada adalah agar aja akan aku apa apakah atau bagaimana bagi banget bang bisa bisakah buat cara caranya dan dari dengan di dong
gimana gak ga gk gitu harus hai halo hallo ini itu jadi juga kak kalau kalo kami kamu kan ke kenapa ko kok lagi lah mau mas min
minta mohon nya pak pake pakai saja saya sih sudah supaya tapi tidak tolong udah untuk yang yg tuh deh nih kah bro gan sis
""".split())

SYN = {
    "lemot": "lag", "ngelag": "lag", "ngeleg": "lag", "leg": "lag", "patah": "lag", "tps": "lag", "berat": "lag",
    "mcpe": "bedrock", "pe": "bedrock", "hp": "bedrock", "geysermc": "geyser",
    "masuk": "join", "connect": "join", "konek": "join", "gabisa": "tidak", "ngga": "tidak", "nggak": "tidak",
    "pluginnya": "plugin", "plugins": "plugin", "mod": "mod", "mods": "mod",
    "op": "operator", "rank": "luckperms", "permission": "luckperms", "perm": "luckperms",
    "anticheat": "vulcan", "voice": "voicechat", "vc": "voicechat",
    "crash": "error", "mati": "error", "eror": "error", "start": "start",
    "versi": "versi", "version": "versi", "java": "java",
    "backup": "backup", "restore": "backup", "world": "world", "map": "world",
    "proxy": "velocity", "bungee": "velocity", "bungeecord": "velocity", "network": "velocity",
}


def plain(h):
    t = re.sub(r"<[^>]+>", " ", h)
    return html.unescape(re.sub(r"\s+", " ", t)).strip()


def build(A, ITEMS, ORDER, url):
    docs = []
    for aid in ORDER:
        it = ITEMS[aid]
        src = re.sub(r'<a href="#home" class="mdh-doc-back">.*?</a>', " ", A[aid], flags=re.S)
        src = re.sub(r"<h1>.*?</h1>", " ", src, flags=re.S)
        body = plain(src)
        heads = [plain(x) for x in re.findall(r"<h2>(.*?)</h2>", A[aid])]
        docs.append({
            "t": it["label"],
            "s": it["seo"],
            "u": url(aid),
            "c": it["cat"],
            "d": it["desc"],
            "h": heads,
            "x": body[:6000],
        })
    data = {
        "v": 1,
        "wa": WA_SUPPORT,
        "stop": sorted(STOP),
        "syn": SYN,
        "answers": [{k: v for k, v in a.items() if k != "id"} | {"id": a["id"]} for a in ANSWERS],
        "docs": docs,
    }
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))
