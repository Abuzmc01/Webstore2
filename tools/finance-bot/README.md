# Bot Notifikasi Keuangan MineIDHost

Semua pencatatan dilakukan di **mineidhost.com/admin-keuangan** (halaman privat, pakai password).
Bot ini **hanya mengirim notifikasi** ke grup WhatsApp keuangan:

- setiap ada **pemasukan/pengeluaran baru**, catatan **diubah**, **dihapus**, atau **dana talang lunas**,
- **tanggal 28 pukul 23.29 WIB**: rekap total periode (pendapatan, pengeluaran per kategori, bersih, total dana, dana talang belum diganti).

Periode: **tanggal 29 bulan lalu s/d tanggal 28 bulan ini**. Tanggal 29 website otomatis mulai periode baru (angka mulai dari nol).
Data lama tidak dihapus dan tetap bisa dilihat dengan memilih periode di website.

```
Admin → mineidhost.com/admin-keuangan → database Upstash (terenkripsi)
                                              ↑ dicek tiap 20 detik
                          bot ini (VPS/Pterodactyl) → grup WhatsApp keuangan
```

> Pakai **nomor WhatsApp khusus bot keuangan** (bukan nomor bot live chat, bukan nomor utama). Library WhatsApp ini tidak resmi, jadi nomor bisa diblokir.
> Bot tidak perlu port terbuka. Kalau bot mati, data di website tetap aman dan notifikasi yang tertunda dikirim setelah bot hidup lagi (maksimal 300 catatan terakhir).

## 1. Siapkan di Vercel (sekali saja)

Project mineidhsot → **Settings → Environment Variables** (centang Production):

| Name | Isi |
|---|---|
| `FIN_ADMIN_PASSWORD` | password halaman admin-keuangan, minimal 10 karakter |
| `FIN_BOT_SECRET` | kode acak minimal 24 karakter (nanti sama dengan di `.env` bot) |
| `FIN_SECRET` | kode acak minimal 32 karakter, kunci enkripsi. **Simpan cadangannya, jangan pernah diganti.** |

Lalu **Redeploy**.

## 2. Pasang bot

1. Buat server egg **node.js generic** (Node 22/25, RAM 512 MB, Main file `index.js`). Tidak perlu port khusus.
2. Upload zip, **Unarchive**, pastikan `index.js`, `package.json`, folder `lib` ada di folder utama.
3. Ganti nama `.env.example` jadi `.env`, isi:
   - `FIN_BOT_SECRET` = sama persis dengan di Vercel
   - `PAIRING_NUMBER` = nomor WhatsApp bot keuangan (628xxx)
4. **Start**. Di Console muncul kode pairing → HP nomor bot → WhatsApp → Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon saja → masukkan kode.
5. Masukkan nomor bot ke **grup WhatsApp keuangan**, ketik `!idgrup` → salin ke `FIN_GROUP_JID` di `.env` → **Restart**.
6. Ketik `!ping` di grup. Coba catat sesuatu di website, dalam ±20 detik notifikasi muncul di grup.

## 3. Perintah di grup (hanya membaca)

| Perintah | Fungsi |
|---|---|
| `!rekap` | rekap sementara periode berjalan |
| `!rekap okt` | rekap periode tertentu |
| `!talang` | dana talang yang belum diganti |
| `!ping` | cek bot aktif |
| `!idgrup` | ID grup untuk `FIN_GROUP_JID` |
| `!bantuan` | daftar perintah |

## 4. Pengaturan `.env`

| Name | Default | Fungsi |
|---|---|---|
| `CUTOFF_DAY` | 28 | tanggal terakhir periode (samakan dengan `FIN_CUTOFF_DAY` di Vercel kalau diubah) |
| `REPORT_TIME` | 23:29 | jam kirim rekap (WIB) |
| `POLL_SECONDS` | 20 | seberapa sering bot mengecek catatan baru |

## Data & keamanan

- Semua transaksi dienkripsi sebelum disimpan. Tanpa `FIN_SECRET` data tidak bisa dibaca.
- Bot hanya bisa **membaca** (notifikasi & rekap). Website menolak pencatatan dari bot.
- Bot hanya merespons di grup `FIN_GROUP_JID`.
- Folder `auth/` = sesi WhatsApp (hapus untuk ganti nomor). Folder `data/` = posisi notifikasi terakhir & status rekap.
