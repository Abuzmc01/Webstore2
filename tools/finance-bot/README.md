# Bot Keuangan MineIDHost

Admin mencatat pemasukan dan pengeluaran lewat chat WhatsApp. Data langsung tersimpan (terenkripsi) di
**mineidhost.com/admin-keuangan**, halaman yang hanya bisa dibuka dengan password. Setiap **tanggal 28**
bot otomatis mengirim laporan bulanan ke grup keuangan.

```
Admin (grup WA keuangan) → bot ini (VPS/Pterodactyl) → mineidhost.com/api/keuangan → database Upstash (terenkripsi)
                                                                         ↳ mineidhost.com/admin-keuangan (password)
```

> Pakai **nomor WhatsApp khusus bot keuangan** (bukan nomor bot live chat, bukan nomor utama). Library WhatsApp ini tidak resmi, jadi nomor bisa diblokir.
> Kalau bot mati, data di website tetap aman. Catatan yang dikirim saat website tidak bisa dihubungi disimpan di bot dan dikirim ulang otomatis.

## 1. Siapkan di Vercel (sekali saja)

Project mineidhsot → **Settings → Environment Variables** (centang Production):

| Name | Isi |
|---|---|
| `FIN_ADMIN_PASSWORD` | password halaman admin-keuangan, minimal 10 karakter |
| `FIN_BOT_SECRET` | kode acak minimal 24 karakter (nanti sama dengan di `.env` bot) |
| `FIN_SECRET` | kode acak minimal 32 karakter, kunci enkripsi. **Simpan cadangannya, jangan pernah diganti.** |

Database Upstash yang dipakai admin mitra ikut dipakai di sini, tidak perlu buat baru. Lalu **Redeploy**.

## 2. Pasang bot

1. Buat server egg **node.js generic** (Node 22/25, RAM 512 MB, Main file `index.js`). Tidak perlu port/allocation khusus.
2. Upload zip, **Unarchive**, pastikan `index.js`, `package.json`, folder `lib` ada di folder utama.
3. Ganti nama `.env.example` jadi `.env`, isi:
   - `FIN_BOT_SECRET` = sama persis dengan di Vercel
   - `PAIRING_NUMBER` = nomor WhatsApp bot keuangan (628xxx)
4. **Start**. Di Console muncul kode pairing → HP nomor bot → WhatsApp → Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon saja → masukkan kode.
5. Masukkan nomor bot ke **grup WhatsApp keuangan**, ketik `!idgrup` → salin ke `FIN_GROUP_JID` di `.env`.
6. Setiap admin ketik `!saya` → salin ID ke `FIN_ADMINS` (contoh `FIN_ADMINS=6281234567890:Abuz,6289876543210:Rizz`). Nama ini yang tercatat di laporan.
7. **Restart**, lalu ketik `!ping` dan `!bantuan`.

## 3. Cara mencatat

| Jenis | Contoh perintah |
|---|---|
| Withdraw Midtrans | `!wd 1.500.000` |
| Pemasukan lain (dana bisnis) | `!masuk bisnis 500rb setoran mitra` |
| Refund dari provider (uang masuk rekening) | `!refund Vultr 450rb kelebihan tagihan` |
| Akun cloud | `!cloud Vultr akun utama 250rb` |
| Baremetal | `!baremetal sgp-medium-1 Ryzen 9 7950X 1.200.000` |
| Endorse | `!endorse NamaKreator 300rb` |
| Jasa developer | `!jasa setup panel 250rb` (atau `!setup panel 250rb`) |
| Dana talang domain | `!talang domain mineidhost.net 3.330` |
| Dana talang lainnya | `!talang beli kabel LAN 50rb` |
| Pengeluaran lain | `!keluar sewa tools 100rb` |

- **Tanggal** opsional: `kemarin`, `10/11`, `10 nov`, `2026-11-10`. Default hari ini.
- **Sumber dana** pengeluaran opsional: `dari midtrans` / `dari bisnis` / `pakai voucher` (default bisnis). Pengeluaran pakai **refund voucher** tetap tercatat, tapi tidak mengurangi total dana.
- **Nominal**: `3.330`, `1.500.000`, `1,5jt`, `500rb`, `250k`.
- Bot membalas dengan **ID** (contoh `#K7Q2PA`). Salah catat? `!hapus K7Q2PA`, atau edit di website.

**Dana talang** = admin memakai uang pribadi dulu. Tercatat atas nama admin yang mengirim pesan.
Setelah uangnya diganti: `!lunas K7Q2PA` (atau `!lunas K7Q2PA dari midtrans`). `!talang` menampilkan yang belum diganti.

Perintah lain: `!rekap` (periode berjalan), `!rekap okt`, `!terakhir`, `!ping`, `!bantuan`.

## 4. Laporan otomatis tanggal 28

Periode tutup buku: tanggal 28 bulan lalu sampai 27 bulan ini. Tanggal 28 pukul 20.00 WIB (bisa diubah di `REPORT_HOUR`) bot mengirim:
- **Pendapatan** (withdraw Midtrans + dana bisnis)
- **Pengeluaran** per kategori
- **Bersih** periode itu
- **Total dana** sampai akhir periode, dipisah sumber Midtrans dan dana bisnis
- **Dana talang** yang belum diganti, per admin

Dana talang dihitung sebagai pengeluaran di periodenya, tapi baru mengurangi total dana setelah ditandai lunas (karena sebelum itu yang keluar uang pribadi admin).

## Data & keamanan

- Semua transaksi dienkripsi sebelum disimpan. Tanpa `FIN_SECRET` data tidak bisa dibaca.
- Website hanya menerima data dari bot yang punya `FIN_BOT_SECRET`, dan halaman admin hanya bisa dibuka dengan `FIN_ADMIN_PASSWORD`. Halaman admin tidak muncul di Google.
- Bot hanya merespons di grup `FIN_GROUP_JID` dan chat pribadi dari admin di `FIN_ADMINS`.
- Folder `auth/` = sesi WhatsApp (hapus untuk ganti nomor). Folder `data/` = antrean catatan tertunda dan status laporan.
