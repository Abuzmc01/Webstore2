# Bot WhatsApp Tiket MineIDHost

Bot ini menerima tiket dari asisten chat di website (lewat `/api/ticket` di Vercel), lalu mengirimnya ke **grup WhatsApp admin** dengan tag semua anggota grup.

```
Pengunjung → asisten di mineidhost.com → /api/ticket (Vercel) → bot ini (VPS) → grup WhatsApp admin (@semua)
```

> **Penting:** bot ini memakai library tidak resmi (Baileys). Gunakan **nomor WhatsApp khusus bot**, jangan nomor utama MineIDHost, karena nomor bisa diblokir WhatsApp sewaktu-waktu. Kalau bot mati atau diblokir, asisten di website otomatis menawarkan tombol "Kirim lewat WhatsApp" ke nomor support, jadi tiket tetap bisa masuk.

## Yang dibutuhkan

- Satu nomor WhatsApp khusus bot (boleh WhatsApp Business), sudah aktif di HP.
- Grup WhatsApp admin, dan nomor bot sudah dimasukkan ke grup itu.
- Server dengan Node.js 20+ yang menyala terus: server Node.js di panel MineIDHost (Pterodactyl) atau VPS.
- Port yang bisa diakses dari internet (allocation di panel atau port VPS).

## Cara 1: Jalankan di panel Pterodactyl (paling mudah)

1. Buat server baru dengan egg **Node.js** (generic), Node 20 atau lebih baru, RAM 512 MB cukup.
2. Upload semua file di folder ini (`index.js`, `package.json`, `.env.example`) ke server tersebut.
3. Salin `.env.example` menjadi `.env`, lalu isi `BOT_SECRET` dengan kode acak panjang (minimal 16 karakter).
   Contoh membuat kode acak: buka https://www.random.org/strings/ atau ketik asal 30+ huruf/angka.
4. Di tab **Startup**, pastikan file utama `index.js` (atau perintah `npm start`), lalu Start server.
   Port tidak perlu diatur, bot otomatis memakai port allocation server (`SERVER_PORT`).
5. Di Console akan muncul **QR code**. Di HP nomor bot: WhatsApp → **Perangkat tertaut** → **Tautkan perangkat** → scan QR.
   Kalau QR sulit discan dari console, isi `PAIRING_NUMBER=628xxxx` (nomor bot) di `.env`, restart, lalu masukkan kode yang muncul lewat menu "Tautkan dengan nomor telepon".
6. Setelah muncul `[OK] Bot WhatsApp terhubung`, buka grup admin dan ketik `!idgrup`. Bot membalas ID grup.
7. Isi `GROUP_JID=` di `.env` dengan ID tersebut, lalu restart server.
8. Ketik `!ping` di grup untuk mengecek bot aktif.

## Cara 2: Jalankan di VPS (Debian/Ubuntu)

```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pm2

# Upload folder wa-bot ke /opt/wa-bot, lalu:
cd /opt/wa-bot
cp .env.example .env && nano .env      # isi BOT_SECRET dan PORT
npm install
node index.js                          # scan QR, ketik !idgrup di grup, isi GROUP_JID, lalu Ctrl+C

pm2 start index.js --name wa-bot       # jalan terus di background
pm2 save && pm2 startup                # otomatis jalan setelah VPS reboot

# buka port bot di firewall (contoh port 3000)
ufw allow 3000/tcp
```

## Hubungkan dengan website (Vercel)

Buka Vercel → project website → **Settings → Environment Variables**, tambahkan:

| Name | Value |
|---|---|
| `WA_BOT_URL` | `http://IP_SERVER_BOT:PORT/ticket` (contoh `http://103.xx.xx.xx:3000/ticket`) |
| `WA_BOT_SECRET` | sama persis dengan `BOT_SECRET` di `.env` bot |

Lalu **Redeploy** website (Deployments → titik tiga → Redeploy) supaya variabel terbaca.

Cek bot dari browser: `http://IP_SERVER_BOT:PORT/health` harus menampilkan `"whatsapp":true,"group":true`.

## Contoh pesan di grup

```
🎫 TIKET BARU MDH-261110-E46L
@semua ada pelanggan yang butuh bantuan.

👤 Nama: Budi
📱 Kontak: 0812 3456 7890
↪️ Balas: https://wa.me/6281234567890
🕒 Waktu: 10/11/2026, 04.05 WIB
🌐 Halaman: https://mineidhost.com/

💬 Pertanyaan:
apakah bisa refund kalau tidak puas

📝 Riwayat chat asisten:
...
```

Semua anggota grup mendapat notifikasi mention. Admin cukup klik link **Balas** untuk chat pelanggan.

## Perintah di grup

| Perintah | Fungsi |
|---|---|
| `!idgrup` | Menampilkan ID grup untuk `GROUP_JID` |
| `!ping` | Mengecek bot aktif dan grup tujuan |

## Keamanan & batasan

- Bot hanya menerima tiket yang membawa `BOT_SECRET` yang benar. Jangan bagikan isi `.env`.
- Maksimal 20 tiket per 10 menit di bot, dan 3 tiket per 10 menit per pengunjung di website.
- Tiket yang masuk saat bot sedang reconnect disimpan di antrean dan dikirim setelah tersambung lagi.
- Semua tiket juga dicatat di `tickets.log`.
- Folder `auth/` berisi sesi login WhatsApp. Kalau bot logout atau ingin ganti nomor, hapus folder `auth/` lalu scan QR ulang.
- Kalau setelah update library bot tidak bisa menautkan perangkat, jalankan `npm update` lalu coba lagi.
