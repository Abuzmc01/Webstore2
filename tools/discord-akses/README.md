# Bot Discord Akses Server MineIDHost

Staf tidak perlu akun admin panel. Untuk masuk ke server pelanggan, staf cukup mengetik di channel staf Discord:

```
/akses server_id:1d3a7b65
```

Muncul form → isi **Gmail staf yang terdaftar** → bot menambahkan Gmail itu sebagai **subuser dengan izin penuh** di server tersebut.
Akses **dicabut otomatis** setelah 24 jam (bisa diatur per perintah dengan `jam:`, maksimal 168 jam).

| Perintah | Fungsi |
|---|---|
| `/akses server_id:<id> [jam:<1-168>]` | minta akses (lalu isi Gmail di form). ID boleh link panel `panel.mineidhost.com/server/1d3a7b65` |
| `/cabut server_id:<id> [gmail:<email>]` | cabut akses sekarang (tanpa gmail = semua akses dari bot di server itu) |
| `/akses-aktif` | daftar akses yang masih berlaku dan kapan habis |

Semua pemberian dan pencabutan tercatat di channel staf (siapa, server apa, Gmail apa, sampai kapan).

**Keamanan**
- Hanya jalan di server Discord dan channel staf yang ditentukan.
- Gmail harus ada di `STAF_EMAILS`. Gmail lain ditolak.
- Staf yang sudah jadi subuser sebelumnya (diberi manual) **tidak** dihapus saat waktu habis.
- Pemilik server tidak bisa dijadikan subuser.
- Bot berjalan di Vercel (`/api/discord`). Tidak perlu server bot, tidak ada risiko blokir.

## Setup (sekali saja)

### 1. Buat akun panel khusus bot
1. Di panel (Admin → Users → Create New) buat user misalnya `bot-akses@mineidhost.com`, set **Administrator: Yes** (supaya bisa mengatur subuser di semua server).
2. Login sebagai user itu → **Account → API Credentials** → buat key (deskripsi "Bot Discord akses", **Allowed IPs kosong**) → salin key **`ptlc_...`**.
   > Ini **Client API key**, bukan Application key. Simpan rahasia: key ini bisa mengakses semua server.

### 2. Buat aplikasi Discord
1. Buka https://discord.com/developers/applications → **New Application** (misal "MineIDHost Akses").
2. **General Information**: salin **Application ID** dan **Public Key**.
3. **Bot** → **Reset Token** → salin token. Tidak perlu intent apa pun.
4. **Installation** (atau OAuth2 → URL Generator): scope `bot` + `applications.commands`, permission **Send Messages** → buka link → undang ke server Discord MineIDHost.
5. Di Discord: **Settings → Advanced → Developer Mode** aktif → klik kanan nama server → **Copy Server ID**, klik kanan channel staf → **Copy Channel ID**.

### 3. Isi di Vercel (Settings → Environment Variables, Production)

| Name | Isi |
|---|---|
| `DISCORD_APP_ID` | Application ID |
| `DISCORD_PUBLIC_KEY` | Public Key |
| `DISCORD_BOT_TOKEN` | Token bot |
| `DISCORD_GUILD_ID` | ID server Discord |
| `DISCORD_CHANNEL_IDS` | ID channel staf (pisahkan koma kalau lebih dari satu; yang pertama dipakai untuk log pencabutan otomatis) |
| `STAF_EMAILS` | Gmail staf, pisahkan koma. Contoh `mineidhost@gmail.com,ziyruu1@gmail.com,rizmc27@gmail.com` |
| `PTERO_CLIENT_KEY` | key `ptlc_...` dari langkah 1 |
| `AKSES_JAM` | opsional, default 24 |

`PTERODACTYL_URL` dan database Upstash sudah ada dari halaman Status Nodes / admin mitra. **Redeploy**.

### 4. Sambungkan ke Discord
1. Buka sekali: **https://mineidhost.com/api/discord?setup=1** → harus muncul `"ok":true`. Ini mendaftarkan perintah slash **dan** mengisi Interactions Endpoint URL otomatis.
2. Kalau bagian `endpoint` bilang gagal: Discord Developer Portal → **General Information → Interactions Endpoint URL** isi `https://mineidhost.com/api/discord` → **Save**.
3. Di channel staf ketik `/akses` → coba dengan server uji.

## Pencabutan otomatis
- GitHub Actions memanggil `https://mineidhost.com/api/discord?sweep=1` setiap ±15 menit (`.github/workflows/akses-sweep.yml`).
- Cadangan: cron Vercel sekali sehari dan setiap kali ada perintah di Discord.
- Jadi akses bisa terlambat dicabut paling lama ±15–30 menit dari waktu yang tertulis.
