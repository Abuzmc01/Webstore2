# -*- coding: utf-8 -*-
# Konten artikel docs MineIDHost (dipakai oleh build_docs.py)
from html import escape


def code(s):
    return '<div class="mdh-doc-code">' + escape(s.strip("\n")) + "</div>"


def note(label, text):
    return f'<div class="mdh-doc-note"><strong>{label}</strong> {text}</div>'


def table(head, rows):
    h = "".join(f"<th>{c}</th>" for c in head)
    b = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<div class="mdh-doc-table"><table><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table></div>'


def ul(items):
    return "<ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"


def ol(items):
    return "<ol>" + "".join(f"<li>{i}</li>" for i in items) + "</ol>"


def article(aid, title, lead, steps, after=""):
    parts = [
        f'\n<article class="mdh-doc-article" id="{aid}">\n',
        '    <a href="#home" class="mdh-doc-back">← Kembali ke Documentation</a>\n',
        f"    <h1>{title}</h1>\n",
        f'    <p class="mdh-doc-article-lead">{lead}</p>\n',
    ]
    for h2, body in steps:
        parts.append(f'    <div class="mdh-doc-step">\n        <h2>{h2}</h2>\n        {body}\n    </div>\n')
    if after:
        parts.append("    " + after + "\n")
    parts.append("</article>\n")
    return "".join(parts)


A = {}

# ---------------------------------------------------------------- MINECRAFT JAVA

A["install-plugin"] = article(
    "install-plugin", "Install Plugin Minecraft",
    "Plugin menambahkan fitur baru ke server Minecraft Java, misalnya proteksi, ekonomi, atau crossplay Bedrock.",
    [
        ("1. Pastikan software mendukung plugin",
         "<p>Plugin hanya jalan di software berbasis Bukkit seperti <strong>Paper</strong>, <strong>Purpur</strong>, atau Spigot. "
         "Server <strong>Vanilla</strong>, Fabric, dan Forge tidak bisa memakai plugin (Fabric/Forge memakai mod).</p>"),
        ("2. Download plugin dari sumber resmi",
         "<p>Ambil plugin dari SpigotMC, Hangar (hangar.papermc.io), Modrinth, atau GitHub resmi pembuatnya. "
         "Hindari plugin \"premium gratis\" dari situs tidak jelas karena sering berisi malware.</p>"
         + note("Cek versi:", "pastikan plugin mendukung versi Minecraft server kamu. Lihat bagian <em>Supported versions</em> di halaman plugin.")),
        ("3. Upload ke folder plugins",
         "<p>Buka <strong>File Manager</strong>, masuk ke folder:</p>" + code("/plugins")
         + "<p>Upload file berekstensi <code>.jar</code>. Kalau plugin dibungkus <code>.zip</code>, ekstrak dulu dan upload jar-nya saja. "
           "Jangan taruh jar di dalam subfolder.</p>"),
        ("4. Pasang dependency",
         "<p>Banyak plugin butuh plugin lain, misalnya <strong>Vault</strong>, <strong>ProtocolLib</strong>, atau <strong>PlaceholderAPI</strong>. "
         "Kalau dependency tidak ada, console akan menampilkan <code>Unknown/missing dependency plugins</code>.</p>"),
        ("5. Restart server",
         "<p>Restart lewat tombol <strong>Restart</strong> di panel. Jangan memakai <code>/reload</code> atau PlugMan karena sering membuat plugin error atau memory leak.</p>"
         "<p>Setelah server menyala, ketik <code>plugins</code> di Console. Plugin berwarna hijau berarti berhasil dimuat, merah berarti gagal. "
         "Lihat <a href=\"#plugin-error\">Plugin Error</a> kalau ada yang merah.</p>"),
    ])

A["upload-world"] = article(
    "upload-world", "Upload World Minecraft",
    "Pindahkan world dari singleplayer atau hosting lain ke server MineIDHost lewat File Manager atau SFTP.",
    [
        ("1. Stop server dan backup",
         "<p>Matikan server, lalu buat backup di menu <strong>Backups</strong> supaya world lama bisa dikembalikan kalau ada masalah.</p>"),
        ("2. Siapkan folder world",
         "<p>Folder world yang benar berisi file <code>level.dat</code> serta folder <code>region</code>. "
         "World singleplayer ada di <code>.minecraft/saves/NamaWorld</code>.</p>"
         "<p>Kompres folder world menjadi <code>.zip</code> supaya upload lebih cepat.</p>"),
        ("3. Upload dan ekstrak",
         "<p>Upload file zip ke folder utama server, klik titik tiga di samping file, lalu pilih <strong>Unarchive</strong>. "
         "Untuk world besar (di atas 1 GB), lebih aman upload lewat <a href=\"#sftp\">SFTP</a>.</p>"),
        ("4. Sesuaikan nama world",
         "<p>Buka <code>server.properties</code> dan isi <code>level-name</code> dengan nama folder world:</p>"
         + code("level-name=NamaWorld")
         + "<p>Paper dan Purpur menyimpan dimensi secara terpisah, jadi strukturnya seperti ini:</p>"
         + code("NamaWorld/            (Overworld)\nNamaWorld_nether/     (Nether, isi folder DIM-1)\nNamaWorld_the_end/    (End, isi folder DIM1)")
         + "<p>World dari singleplayer menyimpan Nether dan End di dalam satu folder (<code>DIM-1</code> dan <code>DIM1</code>). "
           "Paper akan memindahkannya otomatis saat pertama kali start.</p>"),
        ("5. Start server",
         "<p>Nyalakan server dan cek Console. Kalau world dari versi Minecraft yang lebih lama, server akan mengupgrade chunk secara bertahap.</p>"
         + note("Penting:", "world tidak bisa diturunkan versinya. World dari 1.21 tidak bisa dibuka di server 1.20.")
         + "<p>World <strong>Bedrock</strong> (.mcworld) tidak bisa langsung dipakai di server Java. Konversi dulu dengan tool seperti Chunker (chunker.app).</p>"),
    ])

A["change-version"] = article(
    "change-version", "Ganti Versi Server",
    "Cara mengganti versi Minecraft atau software server (misalnya Paper ke Purpur) tanpa kehilangan data.",
    [
        ("1. Backup terlebih dahulu",
         "<p>Buat backup di menu <strong>Backups</strong>. Upgrade versi mengubah file world dan tidak bisa dibatalkan tanpa backup.</p>"),
        ("2. Cek kompatibilitas",
         ul(["Pastikan plugin utama sudah mendukung versi baru.",
             "Upgrade boleh, <strong>downgrade world tidak disarankan</strong> karena chunk bisa rusak.",
             "Pastikan versi Java sesuai. Lihat <a href=\"#java-version\">Versi Java Server</a>."])),
        ("3. Ubah versi di Startup",
         "<p>Buka tab <strong>Startup</strong>, ubah variabel versi Minecraft (misalnya <code>MINECRAFT_VERSION</code>) ke versi yang diinginkan. "
         "Biarkan build number <code>latest</code> kecuali kamu butuh build tertentu.</p>"
         "<p>Di bagian <strong>Docker Image</strong>, pilih Java yang sesuai dengan versi baru.</p>"),
        ("4. Reinstall server",
         "<p>Buka tab <strong>Settings</strong>, klik <strong>Reinstall Server</strong>. Proses ini mengunduh jar server versi baru. "
         "World, plugin, dan konfigurasi tidak dihapus, tetapi tetap pastikan backup sudah ada.</p>"),
        ("5. Start dan cek console",
         "<p>Nyalakan server, tunggu sampai muncul <code>Done</code>, lalu cek apakah ada plugin yang error.</p>"),
    ])

A["operator"] = article(
    "operator", "Menjadi Operator",
    "Operator (OP) memberikan akses ke semua command admin di server.",
    [
        ("Memberi OP lewat Console",
         "<p>Buka <strong>Console</strong> di panel dan ketik:</p>" + code("op NamaPlayer")
         + "<p>Ganti <strong>NamaPlayer</strong> dengan username Minecraft. Pemain Bedrock lewat Geyser memakai awalan titik, misalnya <code>op .NamaBedrock</code>.</p>"),
        ("Mencabut OP",
         code("deop NamaPlayer")),
        ("Lebih aman pakai plugin permission",
         "<p>OP memberi akses ke <em>semua</em> command. Untuk staff, lebih aman memakai <strong>LuckPerms</strong> dan memberi permission sesuai kebutuhan saja.</p>"
         + note("Keamanan:", "jangan memberi OP ke akun yang tidak kamu kenal. Di server offline-mode (cracked), pasang plugin login seperti <a href=\"#mdhsecurity\">MDHSecurity</a> supaya akun OP tidak bisa dipakai orang lain.")),
    ])

A["whitelist"] = article(
    "whitelist", "Whitelist Server",
    "Whitelist membatasi server hanya bisa dimasuki pemain yang terdaftar.",
    [
        ("Aktifkan whitelist", code("whitelist on")),
        ("Tambah dan hapus pemain",
         code("whitelist add NamaPlayer\nwhitelist remove NamaPlayer\nwhitelist list")),
        ("Keluarkan pemain yang tidak terdaftar",
         "<p>Supaya pemain yang sedang online tapi tidak ada di whitelist langsung dikeluarkan, aktifkan di <code>server.properties</code>:</p>"
         + code("enforce-whitelist=true")),
        ("Pemain Bedrock",
         "<p>Untuk pemain Bedrock lewat Geyser + Floodgate, gunakan command Floodgate:</p>"
         + code("fwhitelist add NamaBedrock")
         + note("Catatan:", "di server offline-mode, whitelist berdasarkan nama mudah dipalsukan. Kombinasikan dengan plugin login.")),
    ])

A["optimasi"] = article(
    "optimasi", "Optimasi Server Minecraft",
    "Langkah praktis supaya server tetap lancar walaupun pemain dan world bertambah.",
    [
        ("1. Pakai software yang tepat",
         "<p>Gunakan <strong>Paper</strong> atau <strong>Purpur</strong> untuk server plugin. Keduanya jauh lebih ringan daripada Spigot atau Vanilla.</p>"),
        ("2. Atur view & simulation distance",
         "<p>Di <code>server.properties</code>:</p>"
         + code("view-distance=5\nsimulation-distance=3")
         + "<p><strong>View distance</strong> menentukan seberapa jauh chunk dikirim ke pemain. <strong>Simulation distance</strong> menentukan seberapa jauh mob, tanaman, "
           "dan redstone tetap aktif di sekitar pemain, jadi pengaruhnya paling besar ke CPU.</p>"
         + "<p>Nilai 5 dan 3 adalah setelan yang direkomendasikan MineIDHost untuk server survival dengan banyak pemain. "
           "Farm otomatis hanya bekerja kalau ada pemain dalam jarak 3 chunk, jadi beri tahu pemain untuk berdiri di dekat farm.</p>"
         + note("Catatan:", "simulation distance tidak boleh lebih besar dari view distance. Restart server setelah mengubah server.properties.")),
        ("3. Pre-generate world",
         "<p>Pembuatan chunk baru adalah penyebab lag terbesar saat pemain menjelajah. Generate chunk lebih dulu dengan "
         "<a href=\"#mdhoptimized\">MDHOptimized</a> (<code>/mdho pregen start world 5000</code>) atau Chunky, lalu pasang world border.</p>"),
        ("4. Batasi entity dan redstone",
         "<p>Farm besar, item di tanah, dan mesin redstone bisa membuat TPS turun. MDHOptimized bisa membatasi entity per chunk, "
         "membekukan redstone yang berlebihan, dan memberi tahu lokasi masalahnya.</p>"),
        ("5. Profiling dengan Spark",
         "<p>Kalau tetap lag, cari penyebabnya dengan plugin <strong>Spark</strong>:</p>"
         + code("spark profiler start\n(tunggu 3-5 menit saat lag terjadi)\nspark profiler stop")
         + "<p>Spark memberi link laporan yang menunjukkan plugin atau bagian server yang paling berat.</p>"),
        ("6. Jangan pakai plugin \"RAM cleaner\"",
         "<p>Plugin yang mengklaim membersihkan RAM atau memanggil garbage collector biasanya justru membuat lag spike. "
         "Java sudah mengatur memori sendiri.</p>"),
    ])

A["velocity-proxy"] = article(
    "velocity-proxy", "Setup Velocity Proxy",
    "Velocity menghubungkan beberapa server (misalnya Lobby, Survival, Skyblock) menjadi satu network dengan satu alamat.",
    [
        ("Yang dibutuhkan",
         ul(["Satu server <strong>Velocity</strong> sebagai proxy (port ini yang dipakai pemain).",
             "Satu atau lebih server <strong>Paper/Purpur</strong> sebagai backend.",
             "Alamat dan port setiap backend (lihat tab Network di panel)."])),
        ("1. Daftarkan backend di velocity.toml",
         "<p>Start Velocity sekali, lalu edit <code>velocity.toml</code>:</p>"
         + code('online-mode = true\nplayer-info-forwarding-mode = "modern"\n\n[servers]\nlobby = "IP_BACKEND_1:PORT"\nsurvival = "IP_BACKEND_2:PORT"\ntry = ["lobby"]')
         + "<p>Kalau server kamu menerima pemain non-premium dan memakai plugin login di proxy (misalnya MDHSecurity), set <code>online-mode = false</code> di proxy.</p>"),
        ("2. Salin forwarding secret",
         "<p>Velocity membuat file <code>forwarding.secret</code> berisi kode acak. Kode ini harus sama di semua backend.</p>"),
        ("3. Atur setiap backend Paper",
         "<p>Di <code>server.properties</code> backend:</p>" + code("online-mode=false")
         + "<p>Di <code>config/paper-global.yml</code>:</p>"
         + code("proxies:\n  velocity:\n    enabled: true\n    online-mode: true\n    secret: 'ISI_DARI_forwarding.secret'")
         + "<p>Di <code>spigot.yml</code>, pastikan <code>bungeecord: false</code>.</p>"),
        ("4. Restart semua server",
         "<p>Restart backend dulu, lalu proxy. Pemain join lewat alamat dan port <strong>Velocity</strong>, bukan port backend. "
         "Pindah server dengan <code>/server survival</code>.</p>"
         + note("Keamanan:", "dengan modern forwarding + secret, backend menolak koneksi yang tidak lewat proxy. Jangan bagikan isi <code>forwarding.secret</code>.")),
        ("Crossplay Bedrock di network",
         "<p>Pasang Geyser di proxy, bukan di backend. Lihat <a href=\"#geyser-velocity\">Geyser di Velocity</a>.</p>"),
    ])

# ---------------------------------------------------------------- CROSSPLAY

GEYSER_CFG = """bedrock:
  address: 0.0.0.0
  port: 19132          # ganti dengan port allocation tambahan
  clone-remote-port: false
  transport: nethernet

remote:
  address: auto
  port: 25565          # biarkan, otomatis mengikuti server
  auth-type: floodgate"""

A["java-bedrock-crossplay"] = article(
    "java-bedrock-crossplay", "Java + Bedrock Crossplay",
    "Ringkasan cara membuat pemain Java dan Bedrock (HP, Windows, konsol) bermain di server yang sama dengan GeyserMC dan Floodgate.",
    [
        ("Cara kerjanya",
         ul(["<strong>Geyser</strong> menerjemahkan koneksi Bedrock ke Java, jadi pemain Bedrock bisa masuk server Java.",
             "<strong>Floodgate</strong> membuat pemain Bedrock bisa masuk tanpa akun Java.",
             "<strong>ViaVersion</strong> dibutuhkan kalau versi server lebih lama dari versi Java terbaru, karena Geyser selalu mengikuti versi Java terbaru."])),
        ("Yang dibutuhkan",
         ul(["Server Paper/Purpur (atau Velocity untuk network).",
             "Geyser versi terbaru dan Floodgate.",
             "Satu <strong>allocation tambahan</strong> untuk port Bedrock.",
             "Pemain Bedrock versi 26.40 ke atas."])),
        ("Perubahan penting Oktober 2026",
         "<p>Sejak <strong>Bedrock 26.60</strong> (rilis 27 Oktober 2026), client Bedrock tidak lagi memakai koneksi RakNet lama dan beralih ke <strong>NetherNet</strong>. "
         "Akibatnya:</p>"
         + ul(["Geyser wajib diupdate ke <strong>2.12.1 build 1273 atau lebih baru</strong>.",
               "Port Bedrock sekarang butuh <strong>TCP dan UDP</strong>, bukan UDP saja.",
               "Port Bedrock tidak boleh sama dengan port Java (<code>clone-remote-port: false</code>)."])
         + "<p>Kalau sebelum Oktober crossplay sudah jalan tapi sekarang pemain Bedrock tidak bisa masuk, ikuti panduan <a href=\"#geyser\">Setup GeyserMC</a> versi terbaru.</p>"),
        ("Langkah lengkap",
         ol(["<a href=\"#geyser\">Setup GeyserMC</a> (server tunggal Paper/Purpur).",
             "<a href=\"#floodgate\">Setup Floodgate</a>.",
             "<a href=\"#viaversion\">Pasang ViaVersion</a> kalau versi server di bawah versi Java terbaru.",
             "Untuk network: <a href=\"#geyser-velocity\">Geyser di Velocity</a>."])),
    ])

A["geyser"] = article(
    "geyser", "Setup GeyserMC (Versi Terbaru)",
    "Panduan pasang Geyser di server Paper/Purpur MineIDHost, sudah menyesuaikan perubahan NetherNet di Bedrock 26.60.",
    [
        ("1. Download plugin",
         "<p>Download dari <strong>geysermc.org/download</strong>:</p>"
         + ul(["<code>Geyser-Spigot.jar</code> (dipakai juga untuk Paper dan Purpur)",
               "<code>floodgate-spigot.jar</code>",
               "<code>ViaVersion.jar</code> dari Hangar/SpigotMC, kalau server bukan versi Java terbaru"])
         + "<p>Upload semuanya ke folder <code>/plugins</code>, lalu restart server sekali supaya config dibuat.</p>"),
        ("2. Buat allocation untuk Bedrock",
         "<p>Buka tab <strong>Network</strong> di panel, klik <strong>Create Allocation</strong>. Catat nomor port baru tersebut.</p>"
         "<p>Allocation di panel MineIDHost otomatis membuka <strong>TCP dan UDP</strong>, jadi satu port sudah cukup untuk NetherNet.</p>"
         + note("Tidak bisa tambah allocation?", "hubungi support MineIDHost lewat Discord atau ticket untuk meminta port tambahan.")),
        ("3. Edit config Geyser",
         "<p>Buka <code>plugins/Geyser-Spigot/config.yml</code> dan sesuaikan bagian ini:</p>" + code(GEYSER_CFG)
         + ul(["<code>port</code>: isi dengan port allocation dari langkah 2.",
               "<code>address</code>: harus <code>0.0.0.0</code>. Jangan <code>127.0.0.1</code> karena NetherNet akan gagal.",
               "<code>clone-remote-port</code>: harus <code>false</code>, karena port Java sudah dipakai TCP oleh server.",
               "<code>transport</code>: <code>nethernet</code> untuk Bedrock 26.60 ke atas. Isi <code>both</code> hanya kalau masih ada pemain versi lama, dan itu butuh port UDP kedua di <code>webrtc-port</code>.",
               "<code>auth-type</code>: <code>floodgate</code> supaya pemain Bedrock tidak perlu akun Java."])
         + note("Catatan:", "urutan dan komentar di config bisa sedikit berbeda antar build. Yang penting nilai kunci di atas sama.")),
        ("4. Restart dan cek console",
         "<p>Restart server. Kalau berhasil, console menampilkan baris seperti:</p>"
         + code("Built-in signaling started on http://0.0.0.0:PORT")
         + "<p>Cek versi Geyser dengan command:</p>" + code("geyser version")
         + "<p>Pastikan build-nya 1273 atau lebih baru.</p>"),
        ("5. Cara pemain Bedrock join",
         "<p>Di Minecraft Bedrock: <strong>Play → Servers → Add Server</strong>. Isi alamat server (misalnya <code>play.namaserver.com</code>) dan <strong>port Bedrock</strong>, bukan port Java.</p>"
         "<p>Saat pertama kali join, pemain bisa melihat pertanyaan <em>trust on first use</em>. Itu normal karena koneksi signaling memakai HTTP. Pilih lanjut.</p>"
         + note("Pemain konsol:", "Xbox, PlayStation, dan Switch tidak bisa menambah server dengan mengetik alamat. Mereka perlu cara khusus, misalnya aplikasi BedrockTogether atau trik DNS.")),
        ("Masalah umum",
         table(["Gejala", "Solusi"], [
             ["\"Unable to connect to world\" setelah update Bedrock", "Update Geyser ke build terbaru, pastikan <code>transport: nethernet</code> dan port memakai allocation sendiri."],
             ["Console: <em>Built-in signaling cannot use port ... because the Java server already uses it</em>", "Set <code>clone-remote-port: false</code> dan isi <code>port</code> dengan allocation tambahan."],
             ["Console: <em>RakNet and NetherNet each need their own UDP port</em>", "Kamu memakai <code>transport: both</code>. Ganti ke <code>nethernet</code>, atau isi <code>webrtc-port</code> dengan port lain."],
             ["Console: <em>NetherNet support is NOT enabled</em>", "Config lama masih <code>transport: raknet</code>. Ganti ke <code>nethernet</code>."],
             ["Pemain Bedrock diminta login akun Java", "Floodgate belum terpasang atau <code>auth-type</code> bukan <code>floodgate</code>."],
             ["Server terlihat, tapi join timeout", "Jalankan <code>geyser nethernet advertised</code> dan pastikan alamat yang muncul sama dengan alamat yang dipakai pemain."],
             ["\"Outdated server\" di Bedrock", "Versi server lebih lama dari Java terbaru. Pasang <a href=\"#viaversion\">ViaVersion</a>."],
         ])
         + "<p>Kalau masih gagal, jalankan <code>geyser dump</code> dan kirim link yang muncul ke support MineIDHost.</p>"),
    ])

A["geyser-velocity"] = article(
    "geyser-velocity", "Geyser di Velocity / BungeeCord",
    "Untuk network dengan proxy, Geyser cukup dipasang di proxy. Pemain Bedrock masuk lewat proxy lalu bisa pindah server seperti pemain Java.",
    [
        ("1. Pasang di proxy",
         "<p>Upload ke folder <code>plugins</code> server Velocity:</p>"
         + ul(["<code>Geyser-Velocity.jar</code> (atau <code>Geyser-BungeeCord.jar</code>)",
               "<code>floodgate-velocity.jar</code> (atau <code>floodgate-bungee.jar</code>)"])
         + "<p>Jangan pasang Geyser di backend Paper kalau sudah ada di proxy.</p>"),
        ("2. Buat allocation dan edit config",
         "<p>Tambahkan allocation di server <strong>proxy</strong>, lalu edit <code>plugins/Geyser-Velocity/config.yml</code> dengan nilai yang sama seperti "
         "<a href=\"#geyser\">Setup GeyserMC</a> langkah 3 (<code>address: 0.0.0.0</code>, <code>clone-remote-port: false</code>, <code>transport: nethernet</code>, <code>auth-type: floodgate</code>).</p>"),
        ("3. Floodgate di backend (opsional, disarankan)",
         "<p>Supaya plugin di backend tahu siapa pemain Bedrock (misalnya untuk menu form Bedrock atau skin), pasang juga <code>floodgate-spigot.jar</code> di setiap backend.</p>"
         + ol(["Salin file <code>plugins/floodgate/key.pem</code> dari proxy ke folder <code>plugins/floodgate/</code> di <strong>setiap backend</strong>. File ini harus sama persis.",
               "Di <code>plugins/floodgate/config.yml</code> milik proxy, set <code>send-floodgate-data: true</code>.",
               "Restart backend, lalu proxy."])),
        ("4. Versi backend",
         "<p>Geyser mengikuti versi Java terbaru. Kalau backend memakai versi lama (misalnya 1.20.1), pasang <strong>ViaVersion</strong> di proxy atau di setiap backend supaya pemain Bedrock tidak kena \"Outdated server\".</p>"),
        ("5. Pemain join",
         "<p>Pemain Bedrock memakai alamat server dan <strong>port Bedrock milik proxy</strong>. Pemain Java tetap memakai port Velocity.</p>"
         + note("HAProxy:", "kalau proxy berada di belakang HAProxy/TCPShield, daftarkan IP proxy tersebut di <code>haproxy-protocol-whitelisted-ips</code> pada config Geyser supaya IP asli pemain terbaca.")),
    ])

A["floodgate"] = article(
    "floodgate", "Setup Floodgate",
    "Floodgate membuat pemain Bedrock bisa masuk server Java tanpa memiliki akun Minecraft Java.",
    [
        ("1. Install Floodgate",
         "<p>Upload <code>floodgate-spigot.jar</code> (server biasa) atau <code>floodgate-velocity.jar</code> (proxy) ke folder <code>plugins</code>, lalu restart.</p>"),
        ("2. Hubungkan dengan Geyser",
         "<p>Di config Geyser, set:</p>" + code("auth-type: floodgate")
         + "<p>Kalau Geyser dan Floodgate ada di server yang sama, Geyser otomatis membaca kunci Floodgate.</p>"),
        ("3. Nama pemain Bedrock",
         "<p>Pemain Bedrock mendapat awalan titik, misalnya <code>.Steve123</code>, supaya tidak bentrok dengan nama Java. "
         "Awalan bisa diubah di <code>plugins/floodgate/config.yml</code> bagian <code>username-prefix</code>. "
         "Jangan dikosongkan karena nama Bedrock bisa sama dengan akun Java orang lain.</p>"),
        ("4. Network dengan proxy",
         "<p>File <code>key.pem</code> harus <strong>sama</strong> di proxy dan semua backend. Lihat <a href=\"#geyser-velocity\">Geyser di Velocity</a>.</p>"),
        ("5. Periksa console",
         "<p>Setelah restart, pastikan tidak ada error Floodgate. Error <em>key</em> atau <em>decrypt</em> biasanya berarti <code>key.pem</code> berbeda antar server.</p>"
         + note("Command berguna:", "<code>fwhitelist add NamaBedrock</code> untuk whitelist pemain Bedrock, <code>linkaccount</code> untuk menghubungkan akun Java dan Bedrock milik orang yang sama.")),
    ])

A["viaversion"] = article(
    "viaversion", "Multi Version (ViaVersion)",
    "ViaVersion membuat pemain dengan versi Minecraft berbeda bisa masuk ke server yang sama.",
    [
        ("Plugin yang dibutuhkan",
         table(["Plugin", "Fungsi"], [
             ["<strong>ViaVersion</strong>", "Client <strong>lebih baru</strong> bisa masuk server lama (misalnya client terbaru masuk server 1.20.1)."],
             ["<strong>ViaBackwards</strong>", "Client <strong>lebih lama</strong> bisa masuk server baru. Butuh ViaVersion."],
             ["<strong>ViaRewind</strong>", "Client 1.7 dan 1.8 bisa masuk. Butuh ViaVersion dan ViaBackwards."],
         ])),
        ("1. Install",
         "<p>Download dari Hangar (hangar.papermc.io) atau SpigotMC, upload ke <code>/plugins</code>, lalu restart.</p>"
         "<p>Di network Velocity, cukup pasang di proxy <em>atau</em> di backend, jangan dua-duanya.</p>"),
        ("2. Wajib untuk crossplay Bedrock",
         "<p>Geyser selalu mengikuti versi Java terbaru. Kalau server kamu versi lama, pemain Bedrock akan kena \"Outdated server\" tanpa ViaVersion.</p>"),
        ("3. Selalu update",
         "<p>Setiap Minecraft rilis versi baru, update ViaVersion juga. Versi lama tidak mengenali client terbaru.</p>"
         + note("Catatan:", "blok dan item baru tidak muncul di server lama. Pemain versi baru akan melihat versi pengganti yang paling mirip.")),
    ])

A["bedrock-custom-item"] = article(
    "bedrock-custom-item", "Item Custom & Disconnect di Bedrock",
    "Solusi pemain Bedrock yang disconnect, item tidak muncul, atau model custom rusak di server yang memakai ItemsAdder, MMOItems, atau ModelEngine.",
    [
        ("Kenapa terjadi?",
         "<p>Resource pack Java tidak bisa langsung dibaca Bedrock. Item dan model custom harus dikonversi menjadi resource pack Bedrock plus "
         "<em>mapping</em> untuk Geyser. Kalau mapping tidak cocok dengan resource pack, pemain Bedrock bisa disconnect saat memegang atau memakai item tersebut.</p>"),
        ("1. Update semuanya bersamaan",
         "<p>Update <strong>Geyser</strong>, <strong>Floodgate</strong>, dan extension/plugin pendukung (misalnya <strong>GeyserModelEngine</strong>) ke versi terbaru secara bersamaan. "
         "Versi yang tidak sinkron adalah penyebab paling umum.</p>"),
        ("2. Bersihkan resource pack lama",
         "<p>Buka folder <code>plugins/Geyser-Spigot/packs/</code> (atau <code>Geyser-Velocity/packs/</code>). Hapus resource pack Bedrock versi lama, "
         "lalu ganti dengan hasil konversi terbaru. Mapping di folder <code>custom_mappings</code> harus berasal dari konversi yang sama.</p>"),
        ("3. Tes untuk mencari penyebab",
         ol(["Pindahkan resource pack dari folder <code>packs</code> untuk sementara, lalu restart.",
             "Kalau pemain Bedrock tidak lagi disconnect, masalahnya di resource pack atau mapping.",
             "Kalau masih disconnect, lihat console tepat saat pemain keluar. Nama plugin di error biasanya menunjukkan penyebabnya."])),
        ("4. Model ModelEngine",
         "<p>Model ModelEngine (boss, mob custom) butuh plugin seperti GeyserModelEngine agar tampil di Bedrock. "
         "Setelah menambah atau mengubah model, generate ulang resource pack Bedrock-nya dan restart server.</p>"
         + note("Tips:", "minta pemain Bedrock menghapus cache resource pack di pengaturan Minecraft (Storage → Cached Data) setelah resource pack diganti.")),
    ])

# ---------------------------------------------------------------- PANEL

A["allocation"] = article(
    "allocation", "Allocation / Port",
    "Allocation adalah port jaringan yang dimiliki server kamu di panel.",
    [
        ("Port utama dan port tambahan",
         "<p>Port utama (<em>Primary</em>) dipakai server Minecraft Java. Port tambahan bisa dibuat di tab <strong>Network → Create Allocation</strong>.</p>"
         "<p>Setiap allocation di panel MineIDHost membuka <strong>TCP dan UDP</strong> sekaligus.</p>"),
        ("Kapan butuh port tambahan?",
         ul(["Geyser untuk pemain Bedrock (wajib sejak Bedrock 26.60).",
             "Voice chat (Simple Voice Chat, PlasmoVoice) yang memakai UDP.",
             "Dynmap, BlueMap, atau web map lain.",
             "Query atau RCON."])),
        ("Cara memakai port tambahan",
         "<p>Masukkan nomor port tersebut di config plugin yang membutuhkannya, lalu restart server. Jangan memakai port Java untuk plugin lain.</p>"
         + note("Port habis?", "jumlah allocation tergantung paket. Hubungi support kalau butuh tambahan.")),
    ])

A["sftp"] = article(
    "sftp", "SFTP",
    "SFTP dipakai untuk upload dan download file besar (world, modpack, backup) lebih cepat dan stabil daripada lewat browser.",
    [
        ("1. Lihat detail SFTP",
         "<p>Buka tab <strong>Settings</strong> di panel. Di bagian <strong>SFTP Details</strong> ada alamat server (beserta port) dan username.</p>"),
        ("2. Pakai aplikasi SFTP",
         ul(["<strong>Windows:</strong> WinSCP atau FileZilla.",
             "<strong>macOS/Linux:</strong> FileZilla atau Cyberduck.",
             "<strong>Android:</strong> aplikasi file manager yang mendukung SFTP."])),
        ("3. Login",
         ul(["Protocol: <strong>SFTP</strong> (bukan FTP).",
             "Host dan port: sesuai SFTP Details.",
             "Username: sesuai SFTP Details (formatnya <code>username.idserver</code>).",
             "Password: password akun panel kamu."])
         + note("Gagal login?", "pastikan memilih SFTP, bukan FTP, dan port mengikuti SFTP Details (bukan port Minecraft).")),
    ])

# ---------------------------------------------------------------- TROUBLESHOOTING

A["java-version"] = article(
    "java-version", "Versi Java Server",
    "Setiap versi Minecraft membutuhkan versi Java tertentu. Java yang salah adalah penyebab paling umum server tidak mau start.",
    [
        ("Tabel versi Java",
         table(["Versi Minecraft", "Java yang dipakai"], [
             ["1.8 – 1.16.5", "Java 8 (1.16.5 juga bisa Java 11)"],
             ["1.17 – 1.17.1", "Java 16 atau 17"],
             ["1.18 – 1.20.4", "Java 17"],
             ["1.20.5 – 1.21.11", "Java 21"],
             ["26.1 ke atas", "Java 25"],
         ])),
        ("Cara mengganti Java",
         "<p>Buka tab <strong>Startup</strong>, cari <strong>Docker Image</strong>, lalu pilih versi Java yang sesuai. Restart server.</p>"),
        ("Tanda Java tidak cocok",
         table(["Pesan di console", "Artinya"], [
             ["<code>UnsupportedClassVersionError</code>", "Java terlalu lama untuk server atau plugin. Naikkan versi Java."],
             ["<code>requires running the server with Java 25 or above</code>", "Server 26.x butuh Java 25."],
             ["Server crash di awal pada versi lama (1.12 dan sebelumnya)", "Java terlalu baru. Turunkan ke Java 8."],
         ])),
    ])

A["server-error"] = article(
    "server-error", "Server Tidak Start",
    "Langkah memeriksa server yang mati sendiri, stuck saat startup, atau langsung crash.",
    [
        ("1. Baca console paling bawah",
         "<p>Scroll Console ke baris error terakhir sebelum server berhenti. Biasanya ada kata <code>ERROR</code>, <code>Exception</code>, atau nama plugin.</p>"),
        ("2. Cocokkan dengan masalah umum",
         table(["Pesan / gejala", "Solusi"], [
             ["<code>UnsupportedClassVersionError</code>", "Versi Java salah. Lihat <a href=\"#java-version\">Versi Java Server</a>."],
             ["<code>Failed to bind to port</code>", "Port di config tidak sesuai allocation. Kembalikan <code>server-port</code> di server.properties ke port utama."],
             ["<code>You need to agree to the EULA</code>", "Buka <code>eula.txt</code>, ubah menjadi <code>eula=true</code>."],
             ["<code>OutOfMemoryError</code>", "RAM tidak cukup. Kurangi plugin berat, pre-generate world, atau upgrade paket."],
             ["Error menyebut nama plugin", "Plugin tidak cocok dengan versi server. Lihat <a href=\"#plugin-error\">Plugin Error</a>."],
             ["Stuck di <code>Preparing spawn area</code>", "World besar atau rusak. Tunggu beberapa menit, atau coba restore backup."],
         ])),
        ("3. Tes tanpa plugin",
         "<p>Ganti nama folder <code>plugins</code> menjadi <code>plugins_off</code>, lalu start. Kalau server menyala, masalahnya ada di salah satu plugin. "
         "Kembalikan plugin satu per satu untuk menemukan penyebabnya.</p>"),
        ("4. Masih gagal?",
         "<p>Klik tombol share/upload log di console atau salin 50 baris terakhir, lalu kirim ke support MineIDHost.</p>"),
    ])

A["lag"] = article(
    "lag", "Server Lag",
    "Cara mengetahui apakah lag berasal dari server, dan menemukan penyebabnya.",
    [
        ("1. Cek TPS dan MSPT",
         "<p>Ketik <code>tps</code> (Paper) atau <code>spark tps</code>. TPS normal adalah <strong>20</strong>. "
         "MSPT di atas <strong>50 ms</strong> berarti server tidak sanggup memproses tick dan pemain akan merasakan lag.</p>"
         + note("TPS 20 tapi tetap lag?", "masalahnya kemungkinan ping/internet pemain, bukan server.")),
        ("2. Cari chunk bermasalah",
         "<p>Dengan <a href=\"#mdhoptimized\">MDHOptimized</a>:</p>"
         + code("mdho status\nmdho scan 10\nmdho alerts")
         + "<p>Perintah ini menunjukkan chunk dengan entity terbanyak dan lokasi farm atau redstone yang berlebihan.</p>"),
        ("3. Profiling",
         "<p>Jalankan <code>spark profiler start</code> saat lag terjadi, tunggu beberapa menit, lalu <code>spark profiler stop</code>. "
         "Buka link yang diberikan untuk melihat plugin atau proses paling berat.</p>"),
        ("4. Penyebab umum",
         ul(["Pemain menjelajah chunk baru: pre-generate world dan pasang world border.",
             "Item dan mob menumpuk: pakai clear lag terjadwal dan limit entity per chunk.",
             "Mesin redstone/hopper besar: batasi dengan redstone limiter.",
             "View/simulation distance terlalu tinggi.",
             "Plugin yang menjalankan task terlalu sering."])
         + "<p>Lihat juga <a href=\"#optimasi\">Optimasi Server</a>.</p>"),
    ])

A["connection"] = article(
    "connection", "Tidak Bisa Join Server",
    "Pesan error yang sering muncul saat join dan cara mengatasinya, untuk pemain Java dan Bedrock.",
    [
        ("Pemain Java",
         table(["Pesan", "Solusi"], [
             ["<code>Connection refused</code> / <code>Can't connect to server</code>", "Server mati atau port salah. Pastikan status Running dan alamat memakai port utama."],
             ["<code>Outdated server</code> / <code>Outdated client</code>", "Versi client berbeda. Samakan versinya atau pasang <a href=\"#viaversion\">ViaVersion</a>."],
             ["<code>Failed to verify username</code>", "Client non-premium masuk ke server <code>online-mode=true</code>. Gunakan akun premium atau ubah mode server (pakai plugin login)."],
             ["<code>You are not white-listed</code>", "Tambahkan pemain ke whitelist."],
             ["<code>Unable to connect to backend</code> (network)", "Backend mati atau forwarding secret tidak sama. Lihat <a href=\"#velocity-proxy\">Setup Velocity</a>."],
         ])),
        ("Pemain Bedrock",
         table(["Gejala", "Solusi"], [
             ["\"Unable to connect to world\" setelah update Bedrock 26.60", "Update Geyser ke build 1273+, set <code>transport: nethernet</code>. Lihat <a href=\"#geyser\">Setup GeyserMC</a>."],
             ["Server tidak muncul atau timeout", "Pakai <strong>port Bedrock</strong>, bukan port Java. Pastikan <code>clone-remote-port: false</code>."],
             ["\"Outdated server\"", "Pasang ViaVersion di server."],
             ["Disconnect saat memegang item custom", "Lihat <a href=\"#bedrock-custom-item\">Item Custom di Bedrock</a>."],
         ])),
        ("Masih gagal?",
         "<p>Kirim screenshot pesan error dan alamat yang dipakai ke support MineIDHost.</p>"),
    ])

A["plugin-error"] = article(
    "plugin-error", "Plugin Error",
    "Cara membaca error plugin di console dan memperbaikinya.",
    [
        ("1. Cari nama plugin di console",
         "<p>Error plugin biasanya diawali <code>Could not load 'plugins/NamaPlugin.jar'</code> atau <code>Error occurred while enabling NamaPlugin</code>.</p>"),
        ("2. Cocokkan dengan masalah umum",
         table(["Pesan", "Solusi"], [
             ["<code>Unknown/missing dependency plugins: [Vault]</code>", "Pasang plugin yang disebut di dalam kurung."],
             ["<code>UnsupportedClassVersionError</code>", "Plugin butuh Java lebih baru. Lihat <a href=\"#java-version\">Versi Java</a>."],
             ["<code>Unsupported API version</code>", "Plugin dibuat untuk versi Minecraft lebih baru dari server kamu. Cari versi plugin yang cocok."],
             ["<code>NoSuchMethodError</code> / <code>ClassNotFoundException</code>", "Plugin atau dependency-nya sudah usang. Update plugin dan dependency."],
             ["<code>Ambiguous plugin name</code>", "Ada dua jar plugin yang sama. Hapus salah satunya."],
         ])),
        ("3. Jangan pakai /reload",
         "<p><code>/reload</code> dan PlugMan sering membuat plugin error yang sebenarnya tidak ada. Selalu restart penuh dari panel.</p>"),
        ("4. Curiga plugin berbahaya?",
         "<p>Kalau plugin didapat dari sumber tidak resmi, pindai dengan <a href=\"#mdhantimalware\">MDHAntiMalware</a> dan ganti dengan versi resmi.</p>"),
    ])

# ---------------------------------------------------------------- PLUGIN MINEIDHOST

A["mdhsecurity"] = article(
    "mdhsecurity", "MDHSecurity",
    "Plugin keamanan buatan MineIDHost: login & auto-login premium, anti-bot, anti-grief, log blok + rollback, dan anticheat dasar.",
    [
        ("File dan versi",
         table(["File", "Pasang di", "Versi"], [
             ["<code>MDHSecurity-Velocity.jar</code>", "Proxy Velocity", "3.4+"],
             ["<code>MDHSecurity-BungeeCord.jar</code>", "BungeeCord / Waterfall", "Build terbaru"],
             ["<code>MDHSecurity-Paper.jar</code>", "Backend Paper", "1.20.1 – terbaru"],
             ["<code>MDHSecurity-Purpur.jar</code>", "Backend Purpur", "1.20.1 – terbaru"],
         ])
         + "<p>Butuh <strong>Java 17+</strong> dan database <strong>MySQL/MariaDB</strong>. Semua server memakai database yang sama. Folia tidak didukung.</p>"),
        ("Pasang di network (dengan proxy)",
         ol(["Buat database (misalnya <code>minecraft</code>) dan user MySQL. Di panel, database bisa dibuat di tab <strong>Databases</strong>.",
             "<strong>Proxy:</strong> taruh jar proxy di <code>plugins/</code>, start sekali, isi bagian <code>database</code> di config, lalu restart.",
             "Di proxy, set <code>online-mode = false</code>. Plugin yang menentukan pemain mana yang dicek ke Mojang.",
             "<strong>Setiap backend:</strong> taruh jar Paper/Purpur, start sekali, isi <code>database</code> dan <code>server-name</code> (beda tiap server). Biarkan <code>auth.proxy-mode: true</code>. Restart.",
             "Kunci backend supaya hanya bisa dimasuki lewat proxy. Velocity: <code>player-info-forwarding-mode = \"modern\"</code> + secret di <code>paper-global.yml</code> (lihat <a href=\"#velocity-proxy\">Setup Velocity</a>). BungeeCord: <code>ip_forward: true</code>, <code>bungeecord: true</code> di spigot.yml, dan firewall port backend."])
         + note("Penting:", "tanpa langkah 5, orang bisa masuk langsung ke backend dan melewati pengecekan premium.")),
        ("Pasang tanpa proxy",
         "<p>Pakai jar Paper/Purpur saja dan set <code>auth.proxy-mode: false</code>.</p>"
         + ul(["<code>online-mode=true</code>: semua pemain premium, otomatis login.",
               "<code>online-mode=false</code>: semua pemain Java memakai <code>/register</code> dan <code>/login</code>. Auto-login premium hanya tersedia lewat proxy."])),
        ("Cara kerja login",
         ul(["<strong>Java premium:</strong> langsung masuk tanpa password. Client crack yang memakai nama premium ditolak.",
             "<strong>Java non-premium:</strong> dibekukan (tidak bisa jalan, chat, command, buka chest) sampai <code>/register</code> atau <code>/login</code>.",
             "<strong>Bedrock (Geyser + Floodgate):</strong> otomatis login.",
             "Masuk lagi dari IP yang sama dalam <code>remember-ip-minutes</code> tidak perlu login. Pindah server di network juga tidak.",
             "Password disimpan PBKDF2-SHA256. Hash AuthMe (<code>$SHA$</code>) bisa dibaca, jadi data AuthMe lama bisa dipindahkan ke tabel <code>mdhsec_accounts</code>.",
             "Salah password <code>max-attempts</code> kali: kick dan IP diblokir selama <code>block-minutes</code>.",
             "Anti-bot di proxy: batas koneksi per IP, filter nama, dan mode serangan otomatis."])),
        ("Anti-grief & anticheat",
         ul(["<strong>Pemain baru:</strong> TNT, lava, flint & steel, end crystal baru bisa dipakai setelah main beberapa menit (default 120).",
             "<strong>Proteksi spawn:</strong> blok, container, item frame, armor stand, ledakan, dan api di radius spawn.",
             "<strong>Hewan peliharaan:</strong> hanya bisa dilukai pemiliknya.",
             "<strong>Log:</strong> hancur/taruh blok, ember, ledakan, api, dan isi container.",
             "<strong>Anticheat dasar:</strong> fly, speed, reach, killaura, autoclicker, fastbreak. Default hanya notifikasi + setback, tanpa kick otomatis (<code>command-vl: 0</code>). Kalau sudah memakai Grim/Vulcan, matikan <code>anticheat.enabled</code>."])),
        ("Perintah",
         table(["Perintah", "Fungsi", "Permission"], [
             ["<code>/register &lt;pw&gt; &lt;pw&gt;</code>", "Daftar", "semua"],
             ["<code>/login &lt;pw&gt;</code>", "Login", "semua"],
             ["<code>/changepassword &lt;lama&gt; &lt;baru&gt;</code>", "Ganti password", "semua"],
             ["<code>/premium</code> → <code>/premium confirm</code>", "Pindah ke auto-login premium (UUID berubah)", "semua"],
             ["<code>/mdhsec inspect</code>", "Klik blok untuk melihat riwayat", "mdhsec.inspect"],
             ["<code>/mdhsec lookup &lt;pemain|#tnt|#fire|*&gt; [waktu] [radius]</code>", "Cari riwayat", "mdhsec.inspect"],
             ["<code>/mdhsec rollback &lt;pemain|#tnt|#fire|*&gt; &lt;waktu&gt; [radius]</code>", "Kembalikan perubahan", "mdhsec.rollback"],
             ["<code>/mdhsec undo</code>", "Batalkan rollback terakhir", "mdhsec.rollback"],
             ["<code>/mdhsec alerts</code>", "Nyala/matikan notifikasi anticheat", "mdhsec.alerts"],
             ["<code>/mdhsec info &lt;pemain&gt;</code>", "Data akun + VL", "mdhsec.admin"],
             ["<code>/mdhsec unregister &lt;pemain&gt;</code>", "Hapus akun", "mdhsec.admin"],
             ["<code>/mdhsec changepass &lt;pemain&gt; &lt;pw&gt;</code>", "Ganti password pemain", "mdhsec.admin"],
             ["<code>/mdhsec premium &lt;pemain&gt; on|off</code>", "Atur mode premium", "mdhsec.admin"],
             ["<code>/mdhsec forcelogin &lt;pemain&gt;</code>", "Paksa login", "mdhsec.admin"],
             ["<code>/mdhsec reload</code>", "Muat ulang config", "mdhsec.admin"],
         ])
         + "<p>Format waktu: <code>30m</code>, <code>2h</code>, <code>3d</code>, <code>1w</code>, bisa digabung (<code>1d12h</code>). Target <code>*</code> wajib memakai radius.</p>"
         + "<p>Bypass: <code>mdhsec.bypass.newplayer</code>, <code>mdhsec.bypass.spawn</code> (default OP), <code>mdhsec.bypass.pets</code>, <code>mdhsec.bypass.anticheat</code>.</p>"),
        ("Batasan",
         ul(["Rollback tidak mengembalikan isi chest yang ikut hancur bersama bloknya. Item yang diambil/dimasukkan lewat GUI tercatat dan bisa dikembalikan. Hopper tidak dicatat.",
             "Kasur dan blok multi-bagian lain bisa hanya pulih satu bagian.",
             "<code>/premium</code> mengubah UUID pemain, jadi data plugin lain berbasis UUID (inventory, claim, ekonomi) bisa terpisah."])),
    ])

A["mdhoptimized"] = article(
    "mdhoptimized", "MDHOptimized",
    "Plugin optimasi buatan MineIDHost: pre-generate chunk pintar, clear lag terjadwal, limit redstone & entity, dan notifikasi lokasi masalah.",
    [
        ("Persyaratan",
         ul(["Paper atau Purpur 1.20.1 sampai terbaru (Folia tidak didukung).", "Java 17 atau lebih baru."])),
        ("Instalasi",
         ol(["Taruh <code>MDHOptimized.jar</code> di folder <code>plugins/</code>.",
             "Restart server (jangan <code>/reload</code> atau PlugMan).",
             "Edit <code>plugins/MDHOptimized/config.yml</code> sesuai kebutuhan.",
             "Jalankan <code>/mdho reload</code>."])
         + note("Sudah pakai ClearLag?", "matikan fitur hapus item di ClearLag, atau set <code>clear.enabled: false</code> di MDHOptimized. Jangan jalankan dua-duanya.")),
        ("Perintah",
         table(["Perintah", "Fungsi"], [
             ["<code>/mdho</code>", "Bantuan"],
             ["<code>/mdho status</code>", "TPS, pemain, chunk, entity, redstone yang dibekukan, waktu clear berikutnya, status pregen"],
             ["<code>/mdho scan [n]</code>", "Daftar chunk dengan entity terbanyak (default 10, maks 50)"],
             ["<code>/mdho alerts</code>", "30 peringatan terakhir"],
             ["<code>/mdho tp &lt;nomor&gt;</code>", "Teleport ke lokasi peringatan (<code>/mdho tp 1</code> = terbaru)"],
             ["<code>/mdho clear [items|mobs|all] [world]</code>", "Clear langsung tanpa hitung mundur"],
             ["<code>/mdho pregen start &lt;world&gt; &lt;radius|border&gt; [x z]</code>", "Mulai pre-generate. Radius dalam <strong>blok</strong>"],
             ["<code>/mdho pregen pause|resume|cancel|status</code>", "Kontrol pregen"],
             ["<code>/mdho reload</code>", "Muat ulang config dan timer"],
         ])
         + "<p>Alias: <code>/mdhoptimized</code>, <code>/mdhopt</code>. Permission: <code>mdhoptimized.admin</code> (semua perintah) dan <code>mdhoptimized.alert</code> (menerima notifikasi), keduanya default OP.</p>"),
        ("Pre-generate chunk",
         code("/mdho pregen start world 5000\n/mdho pregen start world 3000 1000 -2000\n/mdho pregen start world_nether border")
         + ul(["Chunk dibuat melingkar dari tengah ke luar.",
               "<strong>Chunk yang sudah ada dilewati</strong>, jadi area yang sudah dijelajahi pemain tidak berubah.",
               "Otomatis pause saat TPS di bawah <code>pregen.min-tps</code> atau pemain online terlalu banyak.",
               "Progres disimpan di <code>pregen.yml</code>, jadi tetap lanjut setelah restart."])),
        ("Clear lag",
         "<p>Setiap <code>clear.interval-seconds</code> (default 900 detik) plugin menghapus item di tanah, XP orb, panah lama, dan mob hostile. "
         "Mob passive hanya dihapus kalau <code>passive-mobs: true</code>.</p>"
         + "<p><strong>Tidak pernah dihapus:</strong> pemain, NPC (Citizens dan sejenisnya), mob bernama, hewan jinak, mob yang dituntun atau ditunggangi, "
           "mob dari plugin (MythicMobs, ModelEngine), dan boss (Wither, Ender Dragon, Warden, Elder Guardian).</p>"),
        ("Redstone & entity limiter",
         ul(["<strong>Redstone:</strong> menghitung sinyal redstone, piston, dan hopper per chunk. Mode <code>NOTIFY</code> hanya memberi peringatan, <code>THROTTLE</code> membekukan mesin di chunk itu selama <code>throttle-seconds</code>.",
             "<strong>Mob:</strong> spawn natural, spawner, breeding, dan sejenisnya dibatasi per chunk. Spawn dari plugin dan command tidak dibatasi, jadi boss MythicMobs tetap aman.",
             "<strong>Item:</strong> default hanya notifikasi."])
         + note("Tips:", "jalankan redstone limiter dengan <code>NOTIFY</code> selama sehari, cek <code>/mdho alerts</code>, baru ganti ke <code>THROTTLE</code> dengan batas yang sesuai server kamu.")),
        ("FAQ",
         "<p><strong>Farm pemain berhenti bekerja?</strong> Kemungkinan kena redstone limiter mode THROTTLE. Cek <code>/mdho alerts</code>, lalu naikkan batasnya atau ganti ke NOTIFY.</p>"
         "<p><strong>Pregen sangat lambat?</strong> Pregen pause saat TPS rendah atau banyak pemain online. Jalankan malam hari, atau naikkan <code>chunks-per-tick</code> dan <code>max-in-flight</code> kalau CPU masih longgar.</p>"),
    ])

A["mdhantimalware"] = article(
    "mdhantimalware", "MDHAntiMalware",
    "Plugin antivirus buatan MineIDHost yang mendeteksi plugin lain berisi malware, menonaktifkannya otomatis, dan memberi tahu admin.",
    [
        ("Fitur",
         ul(["Memindai plugin lain yang terpasang di server untuk mendeteksi kode berbahaya.",
             "Plugin yang terdeteksi berbahaya otomatis dinonaktifkan tanpa perlu mematikan server.",
             "Notifikasi muncul di console dan di dalam game untuk admin.",
             "<strong>Satu file jar</strong> untuk Paper, Purpur, BungeeCord, dan Velocity."])),
        ("Instalasi",
         ol(["Upload jar MDHAntiMalware ke folder <code>plugins/</code> di setiap server dan proxy yang ingin dilindungi.",
             "Restart server.",
             "Cek console. Hasil pemindaian akan muncul saat server menyala."])),
        ("Kalau ada plugin terdeteksi",
         ol(["Hapus file jar plugin tersebut dari folder <code>plugins/</code>.",
             "Download ulang plugin dari sumber resmi (SpigotMC, Hangar, Modrinth, atau GitHub pembuatnya).",
             "Ganti password panel dan database kalau plugin berbahaya sempat aktif.",
             "Cek backup lama. Backup yang dibuat saat plugin berbahaya terpasang juga bisa ikut terinfeksi."])
         + note("Pencegahan:", "malware Minecraft paling sering menyebar lewat plugin premium bajakan. Jangan memasang plugin dari situs atau grup yang tidak jelas.")),
    ])

# ---------------------------------------------------------------- GETTING STARTED & PANEL (ditulis ulang)

A["akses-panel"] = article(
    "akses-panel", "Cara Akses Panel MineIDHost",
    "Panel dipakai untuk mengelola semua hal di server: console, file, plugin, backup, port, dan pengaturan startup.",
    [
        ("1. Buka panel", "<p>Buka alamat berikut di browser:</p>" + code("https://panel.mineidhost.com")),
        ("2. Login",
         "<p>Login memakai email/username dan password yang dikirim setelah pembayaran di billing. "
         "Kalau lupa password, klik <strong>Forgot password</strong> di halaman login.</p>"),
        ("3. Pilih server",
         "<p>Setelah login, klik server yang ingin dikelola. Menu yang paling sering dipakai:</p>"
         + table(["Menu", "Fungsi"], [
             ["Console", "Melihat log dan menjalankan command. Tombol Start, Restart, Stop ada di sini."],
             ["Files", "Upload, edit, dan hapus file. Lihat <a href=\"#file-manager\">File Manager</a>."],
             ["Databases", "Membuat database MySQL untuk plugin seperti LuckPerms atau MDHSecurity."],
             ["Backups", "Membuat dan memulihkan backup. Lihat <a href=\"#backup\">Backup</a>."],
             ["Network", "Menambah port. Lihat <a href=\"#allocation\">Allocation</a>."],
             ["Startup", "Mengganti versi Minecraft dan versi Java."],
             ["Settings", "Detail SFTP, ganti nama server, dan reinstall."],
         ])),
    ])

A["buat-server"] = article(
    "buat-server", "Membuat Server Minecraft",
    "Langkah awal menyiapkan server Minecraft baru di MineIDHost, dari memilih software sampai pemain pertama join.",
    [
        ("1. Pilih software server",
         table(["Software", "Cocok untuk"], [
             ["<strong>Paper</strong>", "Server plugin pada umumnya. Ringan dan paling banyak didukung plugin."],
             ["<strong>Purpur</strong>", "Sama seperti Paper, dengan lebih banyak opsi pengaturan gameplay."],
             ["<strong>Velocity</strong>", "Proxy untuk menggabungkan beberapa server. Lihat <a href=\"#velocity-proxy\">Setup Velocity</a>."],
             ["<strong>Fabric / Forge / NeoForge</strong>", "Server modpack. Tidak bisa memakai plugin."],
             ["<strong>Vanilla</strong>", "Minecraft asli tanpa plugin dan mod."],
         ])),
        ("2. Pilih versi Minecraft",
         "<p>Pilih versi yang didukung plugin atau modpack kamu. Pastikan versi Java juga sesuai, lihat <a href=\"#java-version\">Versi Java Server</a>.</p>"),
        ("3. Start server",
         "<p>Buka <strong>Console</strong> dan klik <strong>Start</strong>. Server siap kalau muncul tulisan <code>Done</code>.</p>"),
        ("4. Join server",
         "<p>Alamat server ada di bagian atas Console (format <code>alamat:port</code>). Di Minecraft Java: <strong>Multiplayer → Add Server</strong>, lalu tempel alamat tersebut.</p>"
         + note("Langkah berikutnya:", "beri diri kamu OP (<a href=\"#operator\">Menjadi Operator</a>), pasang plugin (<a href=\"#install-plugin\">Install Plugin</a>), dan atur <a href=\"#optimasi\">optimasi</a>.")),
    ])

A["file-manager"] = article(
    "file-manager", "File Manager",
    "File Manager di menu Files dipakai untuk mengelola semua file server langsung dari browser.",
    [
        ("Yang bisa dilakukan",
         ul(["Upload file dengan tombol <strong>Upload</strong> atau drag & drop.",
             "Edit file konfigurasi (klik nama file, lalu <strong>Save Content</strong>).",
             "Buat file atau folder baru.",
             "Kompres (<strong>Archive</strong>) dan ekstrak (<strong>Unarchive</strong>) file zip.",
             "Pindah atau ganti nama file (<strong>Rename</strong>, bisa juga untuk memindahkan dengan menulis path folder).",
             "Hapus file. Centang beberapa file untuk menghapus sekaligus."])),
        ("File yang sering diedit",
         table(["File", "Isi"], [
             ["<code>server.properties</code>", "Port, nama world, mode game, online-mode, view distance"],
             ["<code>plugins/NamaPlugin/config.yml</code>", "Pengaturan masing-masing plugin"],
             ["<code>bukkit.yml</code>, <code>spigot.yml</code>, <code>config/paper-*.yml</code>", "Pengaturan performa dan gameplay Paper"],
             ["<code>whitelist.json</code>, <code>ops.json</code>", "Daftar whitelist dan OP"],
         ])),
        ("Tips",
         ul(["File lebih dari 100 MB lebih aman diupload lewat <a href=\"#sftp\">SFTP</a>.",
             "Matikan server sebelum mengganti world atau file plugin yang sedang dipakai.",
             "Edit config YAML dengan spasi, bukan tab. Satu spasi salah bisa membuat plugin gagal membaca config."])
         + note("Peringatan:", "file yang dihapus tidak bisa dikembalikan tanpa backup. Buat backup sebelum menghapus atau mengganti file penting.")),
    ])

A["console"] = article(
    "console", "Console",
    "Console menampilkan log server secara langsung dan dipakai untuk menjalankan command tanpa masuk ke game.",
    [
        ("Fungsi Console",
         ul(["Start, Restart, Stop, dan Kill server.",
             "Melihat log startup, error, dan chat pemain.",
             "Menjalankan command sebagai admin (tanpa garis miring <code>/</code>).",
             "Melihat pemakaian CPU, RAM, dan disk."])),
        ("Command yang sering dipakai",
         table(["Command", "Fungsi"], [
             ["<code>list</code>", "Daftar pemain online"],
             ["<code>op NamaPlayer</code>", "Memberi OP"],
             ["<code>whitelist add NamaPlayer</code>", "Menambah whitelist"],
             ["<code>say Server restart 5 menit lagi</code>", "Pengumuman ke semua pemain"],
             ["<code>plugins</code>", "Daftar plugin (hijau = jalan, merah = error)"],
             ["<code>tps</code>", "Cek performa server (Paper)"],
             ["<code>save-all</code>", "Simpan world sekarang"],
             ["<code>stop</code>", "Matikan server dengan aman"],
         ])),
        ("Stop vs Kill",
         "<p><strong>Stop</strong> menyimpan world lalu mematikan server. <strong>Kill</strong> mematikan paksa tanpa menyimpan. "
         "Pakai Kill hanya kalau server benar-benar hang, karena progres sejak save terakhir bisa hilang.</p>"),
    ])

A["backup"] = article(
    "backup", "Backup Server",
    "Backup menyimpan salinan seluruh file server supaya bisa dikembalikan kalau world rusak, kena grief, atau salah update.",
    [
        ("1. Membuat backup",
         "<p>Buka menu <strong>Backups</strong>, klik <strong>Create Backup</strong>, beri nama (misalnya <code>sebelum-update-1.21</code>), lalu tunggu sampai selesai.</p>"
         "<p>Kolom <strong>Ignored Files</strong> bisa diisi file yang tidak perlu dibackup, misalnya <code>logs</code> atau <code>cache</code>, supaya backup lebih kecil.</p>"),
        ("2. Memulihkan backup",
         "<p>Klik titik tiga di samping backup, pilih <strong>Restore</strong>. File server akan diganti dengan isi backup. "
         "Matikan server terlebih dahulu.</p>"),
        ("3. Download backup",
         "<p>Pilih <strong>Download</strong> untuk menyimpan salinan di komputer. Jumlah slot backup di panel terbatas sesuai paket, "
         "jadi simpan backup penting di tempat lain juga.</p>"),
        ("Kapan harus backup?",
         ul(["Sebelum ganti versi Minecraft.", "Sebelum pasang atau update plugin besar.", "Sebelum ganti world.",
             "Sebelum event besar atau wipe.", "Rutin, misalnya seminggu sekali."])
         + note("Rollback kecil:", "untuk mengembalikan grief di area tertentu tanpa restore seluruh server, pakai fitur rollback plugin seperti <a href=\"#mdhsecurity\">MDHSecurity</a> atau CoreProtect.")),
    ])

# ---------------------------------------------------------------- PLUGIN POPULER

A["luckperms"] = article(
    "luckperms", "Tutorial LuckPerms",
    "LuckPerms adalah plugin permission paling populer untuk membuat rank seperti Member, VIP, Helper, dan Admin.",
    [
        ("1. Install",
         "<p>Download LuckPerms versi Bukkit dari luckperms.net, upload ke <code>/plugins</code>, lalu restart. "
         "Untuk network, pasang versi Velocity di proxy dan versi Bukkit di setiap backend, lalu hubungkan semuanya ke database MySQL yang sama "
         "(atur <code>storage-method: mysql</code> di <code>plugins/LuckPerms/config.yml</code>).</p>"),
        ("2. Buka editor web",
         code("lp editor")
         + "<p>Command ini memberi link editor di browser. Semua rank dan permission bisa diatur di sana, lalu klik <strong>Save</strong> dan jalankan command yang muncul.</p>"),
        ("3. Membuat rank lewat command",
         code("lp creategroup vip\nlp group vip permission set essentials.fly true\nlp group vip meta setprefix 100 \"&6[VIP] \"\nlp group vip parent add default"),
         ),
        ("4. Memberi rank ke pemain",
         code("lp user NamaPlayer parent set vip\nlp user NamaPlayer parent addtemp vip 30d")
         + "<p><code>parent set</code> mengganti rank, <code>addtemp</code> memberi rank sementara (misalnya VIP 30 hari).</p>"),
        ("5. Cek permission",
         code("lp user NamaPlayer info\nlp verbose on")
         + "<p><code>lp verbose on</code> menampilkan permission apa yang dicek saat pemain menjalankan command. Berguna untuk mencari nama permission yang belum diberikan.</p>"
         + note("Prefix di chat:", "prefix LuckPerms tampil di chat lewat plugin chat seperti EssentialsX Chat atau LPC, ditambah Vault.")),
    ])

A["essentialsx"] = article(
    "essentialsx", "Tutorial EssentialsX",
    "EssentialsX menambahkan command dasar yang hampir selalu dipakai server survival: home, warp, spawn, tpa, kit, ekonomi, dan lainnya.",
    [
        ("1. Install",
         "<p>Download dari essentialsx.net. Yang umum dipasang:</p>"
         + ul(["<code>EssentialsX.jar</code> (wajib)", "<code>EssentialsXChat.jar</code> (format chat + prefix)",
               "<code>EssentialsXSpawn.jar</code> (spawn dan spawn pemain baru)", "<strong>Vault</strong> (supaya ekonomi bisa dipakai plugin lain)"])
         + "<p>Upload ke <code>/plugins</code>, lalu restart.</p>"),
        ("2. Atur spawn dan warp",
         code("setspawn\nsetwarp shop\nwarp shop")),
        ("3. Command pemain yang umum",
         table(["Command", "Fungsi", "Permission"], [
             ["<code>/sethome</code>, <code>/home</code>", "Simpan dan kembali ke home", "essentials.sethome, essentials.home"],
             ["<code>/tpa NamaPlayer</code>", "Minta teleport ke pemain", "essentials.tpa"],
             ["<code>/tpaccept</code>", "Terima permintaan teleport", "essentials.tpaccept"],
             ["<code>/spawn</code>", "Kembali ke spawn", "essentials.spawn"],
             ["<code>/balance</code>, <code>/pay</code>", "Cek dan kirim uang", "essentials.balance, essentials.pay"],
             ["<code>/kit starter</code>", "Ambil kit", "essentials.kits.starter"],
         ])
         + "<p>Berikan permission tersebut ke rank default memakai <a href=\"#luckperms\">LuckPerms</a>.</p>"),
        ("4. Konfigurasi penting",
         "<p>Di <code>plugins/Essentials/config.yml</code>:</p>"
         + ul(["<code>sethome-multiple</code>: jumlah home per rank.", "<code>teleport-cooldown</code> dan <code>teleport-delay</code>: jeda teleport.",
               "<code>kits</code>: isi kit starter.", "<code>starting-balance</code>: uang awal pemain baru."])
         + "<p>Jalankan <code>/essentials reload</code> setelah mengubah config.</p>"),
    ])

A["vulcan"] = article(
    "vulcan", "Cara Setup Vulcan Anticheat",
    "Vulcan adalah anticheat berbayar yang populer untuk mendeteksi fly, speed, killaura, reach, dan cheat lainnya.",
    [
        ("1. Beli dan download",
         "<p>Vulcan dijual di SpigotMC. Gunakan hanya versi resmi. Vulcan bajakan sering berisi backdoor.</p>"
         "<p>Vulcan versi terbaru membutuhkan plugin <strong>PacketEvents</strong>. Download juga PacketEvents versi terbaru.</p>"),
        ("2. Upload",
         "<p>Matikan server, upload <code>Vulcan.jar</code> dan <code>packetevents.jar</code> ke <code>/plugins</code>, lalu start server.</p>"),
        ("3. Atur hukuman",
         "<p>Saat pertama dipasang, Vulcan umumnya hanya memberi alert ke staff. Buka <code>plugins/Vulcan/config.yml</code> dan atur per check:</p>"
         + ul(["Aktif atau tidaknya check tersebut.",
               "Berapa banyak pelanggaran (violation) sebelum pemain dihukum.",
               "Command hukuman yang dijalankan, misalnya kick atau ban sementara.",
               "Pesan yang dikirim ke pemain dan ke server."])
         + "<p>Mulailah dengan hukuman ringan (kick), pantau beberapa hari, baru naikkan ke ban.</p>"),
        ("4. Alert untuk staff",
         "<p>Staff dengan permission alert Vulcan akan menerima notifikasi saat ada pemain yang terdeteksi. Command <code>/vulcan</code> menampilkan daftar perintah yang tersedia.</p>"),
        ("Tips agar tidak false ban",
         ul(["Uji di server dengan beberapa pemain sebelum mengaktifkan ban otomatis.",
             "Pemain Bedrock (lewat Geyser) dan pemain dengan ping tinggi lebih sering kena false flag. Cek opsi pengecualian Bedrock/Floodgate di config.",
             "Jangan pasang dua anticheat besar sekaligus (misalnya Vulcan + Grim). Kalau memakai Vulcan, matikan anticheat dasar di <a href=\"#mdhsecurity\">MDHSecurity</a> (<code>anticheat.enabled: false</code>)."])),
    ])

A["voicechat"] = article(
    "voicechat", "Cara Setup Simple Voice Chat",
    "Simple Voice Chat menambahkan voice chat jarak dekat (proximity) di server Minecraft Java.",
    [
        ("Yang dibutuhkan",
         ul(["Plugin Simple Voice Chat di server (versi Bukkit untuk Paper/Purpur, atau mod untuk Fabric/Forge).",
             "Setiap pemain memasang <strong>mod</strong> Simple Voice Chat di client (Fabric, Forge, NeoForge, atau Quilt).",
             "Satu <a href=\"#allocation\">allocation tambahan</a> karena voice chat memakai port UDP sendiri."])
         + note("Bedrock:", "pemain Bedrock lewat Geyser tidak bisa memakai Simple Voice Chat.")),
        ("1. Install plugin",
         "<p>Download dari Modrinth atau CurseForge, upload ke <code>/plugins</code>, lalu restart supaya config dibuat.</p>"),
        ("2. Buat allocation",
         "<p>Di tab <strong>Network</strong>, klik <strong>Create Allocation</strong> dan catat port barunya. Jangan memakai port Java atau port Geyser.</p>"),
        ("3. Atur port",
         "<p>Edit <code>plugins/voicechat/voicechat-server.properties</code>:</p>"
         + code("port=PORT_ALLOCATION_BARU\nbind_address=\nvoice_host=")
         + "<p>Biarkan <code>bind_address</code> dan <code>voice_host</code> kosong kecuali support meminta diisi. Restart server.</p>"),
        ("4. Tes",
         "<p>Join server dengan mod terpasang, tekan <strong>V</strong> untuk membuka menu voice chat. Kalau muncul ikon dicoret atau \"voice chat not connected\":</p>"
         + ul(["Pastikan port di config sama dengan allocation.", "Cek console apakah ada pesan port sudah dipakai.",
               "Pastikan versi mod di client cocok dengan versi plugin di server."])),
    ])

A["spark"] = article(
    "spark", "Cara Pakai Spark Profiler",
    "Spark adalah plugin untuk mencari penyebab lag: plugin mana yang berat, chunk mana yang bermasalah, dan bagaimana pemakaian RAM.",
    [
        ("1. Install",
         "<p>Paper versi baru sudah menyertakan Spark bawaan. Kalau command <code>spark</code> tidak dikenal, download dari spark.lucko.me dan upload ke <code>/plugins</code>.</p>"),
        ("2. Cek TPS dan MSPT",
         code("spark tps")
         + "<p>TPS 20 berarti normal. Perhatikan <strong>MSPT</strong>: di bawah 50 ms aman, di atas 50 ms server mulai lag.</p>"),
        ("3. Profiling saat lag",
         code("spark profiler start\n(biarkan 3-5 menit saat lag terjadi)\nspark profiler stop")
         + "<p>Spark memberi link laporan. Buka link tersebut, lalu lihat bagian yang memakai persentase waktu paling besar. Nama plugin di situ biasanya penyebab lag.</p>"),
        ("4. Cek RAM",
         code("spark health\nspark heapsummary")
         + "<p><code>spark health</code> menampilkan ringkasan CPU, RAM, dan disk. <code>heapsummary</code> menunjukkan apa yang paling banyak memakai memori.</p>"
         + note("Butuh bantuan membaca laporan?", "kirim link laporan Spark ke support MineIDHost.")),
    ])
