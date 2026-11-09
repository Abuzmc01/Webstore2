# Bot Live Chat MineIDHost

Bot ini menjalankan live chat di website mineidhost.com:

```
Pelanggan (chat di website) ⇄ /api/livechat (Vercel) ⇄ bot ini (Pterodactyl/VPS) ⇄ Admin (mineidhost.com/admin-chat)
                                                           ↳ notifikasi grup WhatsApp admin (@semua)
                                                           ↳ email transkrip (Gmail) saat tiket ditutup
```

Alurnya:
1. Pelanggan bertanya ke asisten. Kalau jawabannya tidak ada, pelanggan mengisi nama + email (+ WhatsApp opsional) dan masuk **live chat**.
2. Bot mengirim notifikasi ke **grup WhatsApp admin** dengan tag semua anggota dan link `mineidhost.com/admin-chat#ID-TIKET`.
3. Admin membuka link itu, login, lalu **membalas langsung di website**. Balasan hanya terlihat oleh pelanggan tersebut.
4. Kalau masalah sudah beres, admin klik **"Tanya: sudah selesai?"**. Bot bertanya ke pelanggan *"Apakah masih ada yang bisa kami bantu?"*.
5. Pelanggan menjawab "selesai / sudah / makasih" (atau klik tombol **Sudah selesai**) → tiket **otomatis ditutup**:
   - transkrip dikirim ke email pelanggan dan `mineidhost@gmail.com`,
   - pelanggan diajak memberi rating di Trustpilot (di chat dan di email).
   Kalau pelanggan masih bertanya, tiket dibuka lagi dan grup admin diberi notifikasi.
6. Kalau pelanggan tidak menjawab dalam 30 menit (bisa diubah), tiket ditutup otomatis. Admin juga bisa klik **Tutup tiket** kapan saja.

> **Penting:** notifikasi WhatsApp memakai library tidak resmi (Baileys). Pakai **nomor WhatsApp khusus bot**, jangan nomor utama, karena nomor bisa diblokir WhatsApp. Live chat di website tetap jalan walaupun WhatsApp bot sedang putus; notifikasi akan menyusul setelah tersambung lagi.

## Yang dibutuhkan

- Nomor WhatsApp khusus bot, sudah dimasukkan ke grup admin.
- Server Node.js 20+ yang menyala terus (egg **node.js generic** di Pterodactyl, RAM 512 MB).
- Satu port (allocation) yang bisa diakses dari internet.
- Gmail `mineidhost@gmail.com` dengan **App Password** (lihat di bawah).

## 1. Pasang di Pterodactyl

1. Buat server egg **node.js generic**. Docker image Node 22 (atau 25), Main file `index.js`, Auto Update `0`.
2. Upload zip bot, **Unarchive**, pindahkan isinya ke folder utama (`index.js`, `package.json`, folder `lib` harus di root).
3. Edit `.env`:
   - `BOT_SECRET` = kode acak minimal 16 karakter (nanti sama dengan di Vercel)
   - `ADMIN_EMAILS` = Gmail admin yang boleh login dengan kode, pisahkan koma (contoh `mineidhost@gmail.com,cs1@gmail.com`)
   - `ADMIN_PASSWORD` = opsional, login cadangan dengan password (kosongkan kalau hanya pakai kode Gmail)
   - `GMAIL_APP_PASSWORD` = App Password Gmail (wajib untuk kode login dan transkrip)
4. **Start**. Scan QR di Console dari WhatsApp nomor bot (**Perangkat tertaut → Tautkan perangkat**).
   QR sulit discan? Isi `PAIRING_NUMBER=628xxxx` (nomor bot), restart, lalu pakai "Tautkan dengan nomor telepon".
5. Ketik `!idgrup` di grup admin → salin ID grup ke `GROUP_JID` di `.env` → restart.
6. Ketik `!ping` di grup untuk mengecek.

## 2. App Password Gmail

1. Login ke akun Google `mineidhost@gmail.com` → **Kelola Akun Google → Keamanan**.
2. Aktifkan **Verifikasi 2 Langkah** (wajib).
3. Buka **Sandi aplikasi** (App passwords), buat baru dengan nama "Bot Live Chat".
4. Salin 16 huruf yang muncul ke `GMAIL_APP_PASSWORD` di `.env`, lalu restart bot.

## 3. Hubungkan ke website (Vercel)

Vercel → project website → **Settings → Environment Variables**:

| Name | Value |
|---|---|
| `BOT_URL` | `http://IP_SERVER_BOT:PORT` (contoh `http://103.xx.xx.xx:25570`) |
| `BOT_SECRET` | sama persis dengan `BOT_SECRET` di `.env` bot |

Lalu **Deployments → titik tiga → Redeploy**.

Cek bot: buka `http://IP_SERVER_BOT:PORT/health` → harus `"whatsapp":true,"group":true,"email":true`.

## 4. Pakai

- Admin: buka **mineidhost.com/admin-chat** (atau link di notifikasi WhatsApp), isi username, pilih jabatan (Technical, CS, Founder, Billing Department), masukkan Gmail admin, klik **Kirim kode**, lalu masukkan kode 6 angka dari email. Nama tampil ke pelanggan: `username Jabatan | MineIDHost`.
- Pelanggan dan admin bisa mengirim **foto** lewat tombol 📷. Foto dikecilkan otomatis, disimpan di `data/uploads/`, dan ikut dilampirkan di email transkrip.
- Tiket yang menunggu balasan ditandai **Menunggu**. Halaman admin berbunyi saat ada pesan baru.
- Tombol cepat tersedia untuk sapaan dan balasan umum.

## Perintah di grup WhatsApp

| Perintah | Fungsi |
|---|---|
| `!idgrup` | Menampilkan ID grup untuk `GROUP_JID` |
| `!ping` | Cek bot aktif, grup tujuan, dan link admin chat |

## Data & keamanan

- Semua tiket tersimpan di `data/tickets.json`. Backup folder `data/` kalau perlu.
- Folder `auth/` berisi sesi login WhatsApp. Hapus folder ini untuk ganti nomor atau kalau bot logout.
- Website hanya bisa berbicara dengan bot lewat `BOT_SECRET`. Pelanggan hanya bisa membaca tiketnya sendiri (token acak). Admin harus login dengan kode Gmail (email harus ada di `ADMIN_EMAILS`) atau `ADMIN_PASSWORD`.
- Kode login berlaku 10 menit, maksimal 5 percobaan, dan maksimal 3 permintaan kode per 10 menit per email.
- Batas: 3 tiket per 10 menit per pengunjung, 15 pesan per menit per tiket, 8 percobaan login admin per 10 menit.
