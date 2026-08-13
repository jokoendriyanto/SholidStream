<div align="center">

# SholidStream

### Distributed Streaming SaaS Core + StreamFlow Legacy Bridge

**SholidStream** adalah pengembangan dari StreamFlow menuju platform streaming SaaS yang memiliki PostgreSQL, Redis/BullMQ, object storage, distributed stream workers, worker allocator, durable scheduler, watchdog/recovery/failover, YouTube integration foundation, entitlement/billing core, automation, API v1, dan control plane terpisah.

> SholidStream masih mempertahankan runtime StreamFlow lama (`app.js` + SQLite) sebagai **legacy/rollback bridge** selama proses cutover. Jangan menghapus data SQLite atau deployment legacy sebelum seluruh fitur yang Anda gunakan sudah tervalidasi pada control plane baru.

[Deployment Production](#-deployment-production-recommended) • [Konfigurasi `.env`](#-konfigurasi-environment-env) • [Reverse Proxy + SSL](#-reverse-proxy-nginx--https) • [Scaling Worker](#-scaling-stream-worker) • [Backup](#-backup--restore) • [Update](#-update--rollback) • [Troubleshooting](#-troubleshooting)

</div>

---

## 📌 Status Arsitektur

Arsitektur utama saat ini:

```text
                         SHOLIDSTREAM
                              │
               ┌──────────────┴──────────────┐
               │                             │
         LEGACY BRIDGE                 CONTROL PLANE
               │                             │
        app.js + SQLite                PostgreSQL + Redis
               │                             │
       legacy StreamFlow         Scheduler / Watchdog / API
                                             │
                                           BullMQ
                                             │
                                      Worker Allocator
                                  ┌──────────┼──────────┐
                                  │          │          │
                              Worker A   Worker B   Worker C
                                  │          │          │
                                FFmpeg     FFmpeg     FFmpeg
                                  │          │          │
                                  └──────────┼──────────┘
                                             │
                              YouTube / RTMP / RTMPS
```

Komponen SaaS utama:

- **PostgreSQL** — source of truth untuk tenant/workspace, stream runtime, schedule, worker registry, automation, billing, API key, dan integration state.
- **Redis + BullMQ** — durable job/command transport antara control plane dan worker.
- **Control Plane** — API, scheduler, watchdog, automation scheduler, capacity reconciler, health endpoint, metrics, dan operational dashboard.
- **Stream Worker** — menjalankan lifecycle FFmpeg secara independen dari web/control plane.
- **Worker Registry + Allocator** — memilih worker berdasarkan health, capacity, region, dan runtime state.
- **Lease + Generation Fencing** — mencegah dua worker memiliki session generation yang sama.
- **Object Storage** — local untuk development; S3-compatible storage direkomendasikan untuk multi-worker/production.
- **Legacy Bridge** — `app.js`, SQLite, upload lama, dan UI StreamFlow tetap tersedia untuk incremental cutover.

---

## ⚠️ Baca Sebelum Production

Ada beberapa batas implementasi yang harus dipahami sebelum membuka layanan ke publik:

1. **`/saas` saat ini adalah operational dashboard awal dan belum memiliki application-level login sendiri.** Jika dipublikasikan, lindungi dengan reverse-proxy authentication, VPN, Zero Trust, atau batasi hanya dari jaringan admin.
2. **`/metrics` jangan dibuka bebas ke Internet.** Batasi ke localhost/monitoring network.
3. **YouTube Integration V2 sudah memiliki domain/service foundation**, tetapi seluruh OAuth callback/UI/cutover legacy belum selesai di control plane baru. Jangan menganggap `YOUTUBE_REDIRECT_URI` otomatis aktif hanya karena variabelnya tersedia.
4. **Importer production SQLite → PostgreSQL belum merupakan proses otomatis one-command.** Tetap simpan backup database SQLite lama.
5. **Billing domain sudah tersedia tetapi payment gateway riil belum menjadi bagian deployment ini.** Jangan aktifkan entitlement enforcement sampai plan/subscription/entitlement sudah diprovision dengan benar.
6. **Playlist/composition dan beberapa automation legacy belum seluruhnya feature-parity pada distributed worker.** Lakukan staging dengan workflow nyata Anda sebelum cutover penuh.
7. Untuk multi-worker, **jangan menggunakan local filesystem sebagai authoritative shared media storage**. Gunakan S3-compatible storage.

---

# 🚀 Deployment Production (Recommended)

Panduan utama di bawah menggunakan:

- Ubuntu/Debian server
- Docker Engine
- Docker Compose v2 (`docker compose`)
- PostgreSQL 16 container
- Redis 7 container
- MinIO atau S3-compatible object storage
- Nginx sebagai reverse proxy
- HTTPS melalui Certbot atau TLS termination lain

Docker image project menggunakan **Node.js 20** dan sudah meng-install **FFmpeg** di dalam image.

---

## 1. Topologi Deployment yang Direkomendasikan

Untuk instalasi awal production/single-host:

```text
Internet
   │
   ▼
Nginx :443
   │
   ├── control.example.com ──> 127.0.0.1:7580
   │                              Control Plane
   │
   └── legacy.example.com ──> 127.0.0.1:7575   (opsional selama cutover)

Docker private network
   ├── PostgreSQL :5432
   ├── Redis      :6379
   ├── MinIO      :9000
   ├── Control Plane :7580
   └── Stream Worker(s)
          │
          └── outbound RTMP/RTMPS/HTTPS
```

Untuk multi-node production, gunakan PostgreSQL, Redis, dan S3/object storage yang dapat diakses melalui **private network** oleh semua worker. Worker tidak membutuhkan port inbound publik.

---

## 2. Port dan Network Policy

| Port | Komponen | Public? | Catatan |
|---|---|---:|---|
| 22 | SSH | Ya, terbatas | Sebaiknya hanya IP admin/VPN |
| 80 | Nginx HTTP | Ya | Redirect ke HTTPS |
| 443 | Nginx HTTPS | Ya | Endpoint publik utama |
| 7575 | Legacy StreamFlow | Tidak | Bind localhost selama cutover |
| 7580 | Control Plane | Tidak langsung | Akses melalui Nginx |
| 5432 | PostgreSQL | Tidak | Private network only |
| 6379 | Redis | Tidak | Private network only |
| 9000 | MinIO S3 API | Tidak | Private/localhost only |
| 9001 | MinIO Console | Tidak | Admin only |
| 1935/outbound | RTMP | Outbound | Tergantung destination |
| 443/outbound | RTMPS/HTTPS | Outbound | YouTube/API/object storage |

> **Penting:** Docker port publishing dapat berinteraksi dengan firewall host dengan cara yang tidak selalu intuitif. Untuk service admin/internal, lebih aman bind langsung ke `127.0.0.1` atau private interface daripada hanya berharap UFW memblokir port publik.

---

## 3. Persiapan Server

Update package:

```bash
sudo apt update
sudo apt upgrade -y
```

Install utility dasar:

```bash
sudo apt install -y git curl ca-certificates openssl nginx
```

Install Docker Engine + Docker Compose plugin menggunakan dokumentasi resmi Docker untuk distro Anda.

Verifikasi:

```bash
docker --version
docker compose version
git --version
```

Opsional, jika user non-root akan menjalankan Docker:

```bash
sudo usermod -aG docker "$USER"
```

Logout/login kembali setelah perubahan group.

---

## 4. Clone Repository

```bash
cd /opt
sudo git clone https://github.com/jokoendriyanto/SholidStream.git sholidstream
sudo chown -R "$USER":"$USER" /opt/sholidstream
cd /opt/sholidstream
```

Catat commit sebelum deployment:

```bash
git rev-parse HEAD
```

Ini penting untuk rollback.

---

# 🔐 Konfigurasi Environment `.env`

## 5. Buat `.env`

```bash
cp .env.example .env
chmod 600 .env
```

Generate secret yang kuat:

```bash
# SESSION_SECRET
openssl rand -hex 32

# DATA_ENCRYPTION_KEY — output 64 hex = 32 byte key
openssl rand -hex 32

# Contoh password PostgreSQL yang aman untuk URL
openssl rand -hex 24

# Contoh password MinIO
openssl rand -hex 24
```

**Simpan secret tersebut di password manager/secret manager. Jangan commit `.env`.**

`DATA_ENCRYPTION_KEY` adalah critical secret. Jika key berubah/hilang, ciphertext token/credential yang sudah tersimpan tidak dapat didekripsi kembali.

---

## 6. Contoh `.env` Production

Contoh untuk single-host Docker + MinIO:

```env
# Runtime
NODE_ENV=production
PORT=7575
CONTROL_PLANE_PORT=7580

# Legacy/session
SESSION_SECRET=PASTE_RANDOM_SESSION_SECRET

# Encryption baru — JANGAN diganti setelah data terenkripsi tersimpan
DATA_ENCRYPTION_KEY=PASTE_64_HEX_DATA_ENCRYPTION_KEY
DATA_ENCRYPTION_KEY_VERSION=v1

# Hanya dibutuhkan jika nanti melakukan migrasi ciphertext legacy
LEGACY_SESSION_SECRET=

# PostgreSQL
DATABASE_URL=postgresql://sholidstream:PASTE_POSTGRES_PASSWORD@postgres:5432/sholidstream
DATABASE_SSL=false
DATABASE_POOL_MAX=20

# Redis / BullMQ
REDIS_URL=redis://redis:6379
QUEUE_PREFIX=sholidstream

# Control plane loop intervals
SCHEDULER_TICK_MS=5000
WATCHDOG_TICK_MS=15000
CONTROL_MAINTENANCE_MS=30000

# Billing/entitlement
# Biarkan false sampai plan/subscription/entitlement sudah benar-benar diprovision.
ENTITLEMENTS_ENFORCED=false

# Stream worker
STREAM_WORKER_CONCURRENCY=2
STREAM_WORKER_MAX_STREAMS=2
STREAM_WORKER_HEARTBEAT_MS=15000
STREAM_WORKER_LEASE_MS=45000
STREAM_WORKER_REGION=id-default

# Untuk Docker Compose --scale, sebaiknya kosong agar hostname container unik menjadi worker key.
STREAM_WORKER_KEY=

FFMPEG_PATH=/usr/bin/ffmpeg

# Production multi-worker: gunakan S3-compatible storage
STORAGE_DRIVER=s3
LOCAL_STORAGE_ROOT=./data/storage

# MinIO/S3
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=sholidstream
S3_ACCESS_KEY_ID=minio
S3_SECRET_ACCESS_KEY=PASTE_MINIO_PASSWORD
S3_FORCE_PATH_STYLE=true

# YouTube V2 foundation
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REDIRECT_URI=https://control.example.com/api/v1/integrations/youtube/callback
YOUTUBE_DAILY_QUOTA_BUDGET=10000
```

Catatan:

- `STREAM_WORKER_MAX_STREAMS` sebaiknya **>= `STREAM_WORKER_CONCURRENCY`**.
- `STREAM_WORKER_LEASE_MS` harus lebih besar dari heartbeat interval. Default repository menggunakan 45 detik lease dan 15 detik heartbeat.
- Jika memakai managed PostgreSQL dengan SSL, sesuaikan `DATABASE_SSL` dan connection string.
- Jika memakai AWS S3/R2/B2/object storage lain, ganti endpoint/region/bucket/credential sesuai provider.
- Untuk Amazon S3 native, `S3_ENDPOINT` dapat dikosongkan jika client/provider configuration tidak membutuhkannya dan `S3_FORCE_PATH_STYLE=false`.

---

## 7. Sinkronkan Credential Docker Compose

File `docker-compose.saas.yml` saat ini membawa nilai bootstrap/default untuk PostgreSQL dan MinIO. **Jangan gunakan password default tersebut pada server production.**

Sebelum start, edit:

```bash
nano docker-compose.saas.yml
```

Ubah bagian PostgreSQL:

```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: sholidstream
    POSTGRES_USER: sholidstream
    POSTGRES_PASSWORD: PASTE_POSTGRES_PASSWORD
```

Password ini harus sama dengan password di `DATABASE_URL`.

Ubah MinIO:

```yaml
minio:
  environment:
    MINIO_ROOT_USER: minio
    MINIO_ROOT_PASSWORD: PASTE_MINIO_PASSWORD
```

Untuk deployment production yang lebih matang, gunakan MinIO service account / S3 IAM credential dengan akses minimal ke bucket SholidStream, bukan root credential.

---

## 8. Bind Internal Port ke Localhost

Pada server yang sama dengan Nginx, ubah port control plane dari:

```yaml
ports: ["7580:7580"]
```

menjadi:

```yaml
ports: ["127.0.0.1:7580:7580"]
```

Ubah MinIO dari:

```yaml
ports: ["9000:9000", "9001:9001"]
```

menjadi:

```yaml
ports:
  - "127.0.0.1:9000:9000"
  - "127.0.0.1:9001:9001"
```

Jika control plane berada di belakang external load balancer/private interface, bind ke private IP sesuai topologi Anda.

---

## 9. Validasi Compose Sebelum Start

```bash
docker compose -f docker-compose.saas.yml config >/tmp/sholidstream-compose.rendered.yml
```

Jika command gagal, perbaiki YAML/env lebih dulu.

Pastikan `.env` tidak accidental tracked:

```bash
git status --short
```

Jangan lanjut jika `.env` terlihat sebagai file yang akan di-commit.

---

# 🐳 Menjalankan SaaS Stack

## 10. Build Image

```bash
docker compose -f docker-compose.saas.yml build --pull
```

Image meng-install Node.js production dependencies dan FFmpeg.

---

## 11. Start Infrastructure Dulu

```bash
docker compose -f docker-compose.saas.yml up -d postgres redis minio
```

Cek:

```bash
docker compose -f docker-compose.saas.yml ps
```

PostgreSQL dan Redis harus mencapai status healthy.

---

## 12. Buat Bucket Object Storage

Jika menggunakan MinIO bawaan:

1. Buka sementara melalui SSH tunnel atau akses localhost server.
2. MinIO Console berjalan di `127.0.0.1:9001`.
3. Login menggunakan credential MinIO yang Anda set.
4. Buat bucket bernama sesuai `S3_BUCKET`, default:

```text
sholidstream
```

Jangan membuat bucket public kecuali ada kebutuhan yang benar-benar terkontrol. Media private sebaiknya diakses melalui signed URL/object-storage policy yang tepat.

Contoh SSH tunnel dari komputer admin:

```bash
ssh -L 9001:127.0.0.1:9001 user@IP_SERVER
```

Lalu buka:

```text
http://127.0.0.1:9001
```

---

## 13. Jalankan Database Migration

```bash
docker compose -f docker-compose.saas.yml run --rm migrate
```

Migration harus selesai tanpa error.

Lihat status database:

```bash
docker compose -f docker-compose.saas.yml exec postgres \
  psql -U sholidstream -d sholidstream -c '\dt'
```

Anda seharusnya melihat tabel SaaS seperti workspace, stream runtime, worker registry, schedules, integration, billing, automation, API keys, dan tabel migration metadata.

---

## 14. Start Control Plane + Worker

```bash
docker compose -f docker-compose.saas.yml up -d control-plane stream-worker
```

Atau setelah initial setup:

```bash
docker compose -f docker-compose.saas.yml up -d
```

Cek seluruh service:

```bash
docker compose -f docker-compose.saas.yml ps -a
```

Service `migrate` boleh berada pada status exited **dengan exit code 0** karena memang one-shot job.

---

## 15. Cek Logs

Control Plane:

```bash
docker compose -f docker-compose.saas.yml logs -f --tail=200 control-plane
```

Worker:

```bash
docker compose -f docker-compose.saas.yml logs -f --tail=200 stream-worker
```

PostgreSQL:

```bash
docker compose -f docker-compose.saas.yml logs -f --tail=100 postgres
```

Redis:

```bash
docker compose -f docker-compose.saas.yml logs -f --tail=100 redis
```

---

# ❤️ Health Check & Smoke Test

## 16. Liveness

```bash
curl -fsS http://127.0.0.1:7580/live
```

Endpoint ini memeriksa apakah control plane process hidup.

---

## 17. Readiness

```bash
curl -i http://127.0.0.1:7580/ready
```

Expected HTTP status:

```text
200
```

Readiness memeriksa dependency utama seperti PostgreSQL dan Redis. Jika dependency kritis gagal, endpoint mengembalikan `503`.

---

## 18. Metrics

```bash
curl http://127.0.0.1:7580/metrics
```

Gunakan endpoint ini untuk Prometheus/monitoring internal. **Jangan expose `/metrics` secara publik tanpa network restriction/authentication.**

---

## 19. Operational Dashboard

Dashboard awal tersedia pada:

```text
http://127.0.0.1:7580/saas
```

> Saat ini `/saas` belum memiliki app-level authentication. Protect melalui Nginx Basic Auth, VPN, Cloudflare Access, Tailscale, private network, atau mekanisme Zero Trust lain sebelum dibuka dari Internet.

---

# 🔑 Bootstrap API Key

API v1 menggunakan bearer key dengan prefix `ssk_`. Plain token hanya tersedia ketika key dibuat; database menyimpan SHA-256 hash.

## 20. Buat Platform Admin API Key

Jalankan satu kali:

```bash
docker compose -f docker-compose.saas.yml exec -T control-plane node <<'NODE'
const { getPostgresPool, closePostgresPool } = require('./src/infrastructure/database/postgres');
const { ApiKeyRepository } = require('./src/security/api-key-repository');

(async () => {
  const repo = new ApiKeyRepository(getPostgresPool());
  const result = await repo.create({
    workspaceId: null,
    name: 'bootstrap-platform-admin',
    scopes: ['admin:platform', 'workers:read'],
    platformAdmin: true
  });
  console.log('\nSAVE THIS TOKEN NOW. IT WILL NOT BE STORED IN PLAINTEXT:\n');
  console.log(result.token);
  await closePostgresPool();
})().catch(async (error) => {
  console.error(error);
  await closePostgresPool().catch(() => {});
  process.exit(1);
});
NODE
```

Simpan token di secret manager.

Test API:

```bash
export SHOLIDSTREAM_TOKEN='ssk_xxxxxxxxx'

curl -fsS \
  -H "Authorization: Bearer $SHOLIDSTREAM_TOKEN" \
  http://127.0.0.1:7580/api/v1/me
```

Admin overview:

```bash
curl -fsS \
  -H "Authorization: Bearer $SHOLIDSTREAM_TOKEN" \
  http://127.0.0.1:7580/api/v1/admin/overview
```

Workers:

```bash
curl -fsS \
  -H "Authorization: Bearer $SHOLIDSTREAM_TOKEN" \
  http://127.0.0.1:7580/api/v1/workers
```

Untuk stream API tenant, gunakan **workspace-scoped API key**, bukan platform admin key untuk aplikasi customer.

---

# 🌐 Reverse Proxy Nginx + HTTPS

## 21. Install Nginx + Basic Auth Utility + Certbot

Ubuntu/Debian:

```bash
sudo apt install -y nginx apache2-utils certbot python3-certbot-nginx
```

Buat password untuk `/saas`:

```bash
sudo htpasswd -c /etc/nginx/.sholidstream-admin sholidadmin
```

---

## 22. Nginx Control Plane

Buat:

```bash
sudo nano /etc/nginx/sites-available/sholidstream-control
```

Contoh:

```nginx
server {
    listen 80;
    server_name control.example.com;

    client_max_body_size 10m;

    # Operational dashboard belum punya app-level login.
    location ^~ /saas {
        auth_basic "SholidStream Admin";
        auth_basic_user_file /etc/nginx/.sholidstream-admin;

        proxy_pass http://127.0.0.1:7580;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Metrics hanya untuk localhost. Sesuaikan jika Prometheus ada di private network lain.
    location = /metrics {
        allow 127.0.0.1;
        deny all;

        proxy_pass http://127.0.0.1:7580;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:7580;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Aktifkan:

```bash
sudo ln -s /etc/nginx/sites-available/sholidstream-control /etc/nginx/sites-enabled/sholidstream-control
sudo nginx -t
sudo systemctl reload nginx
```

---

## 23. Aktifkan HTTPS

Pastikan DNS `control.example.com` mengarah ke IP server.

Kemudian:

```bash
sudo certbot --nginx -d control.example.com
```

Verifikasi:

```bash
curl -I https://control.example.com/live
curl -I https://control.example.com/ready
```

Setelah HTTPS aktif, jangan membuka port `7580` ke publik.

---

# 🧱 Legacy StreamFlow Bridge (Opsional tetapi Direkomendasikan Saat Cutover)

Runtime lama masih dapat dijalankan melalui `docker-compose.yml`.

Sebelum start, ubah port:

```yaml
ports:
  - "127.0.0.1:7575:7575"
```

Start:

```bash
docker compose -f docker-compose.yml up -d --build
```

Logs:

```bash
docker compose -f docker-compose.yml logs -f app
```

Gunakan subdomain terpisah, misalnya:

```text
legacy.example.com -> 127.0.0.1:7575
control.example.com -> 127.0.0.1:7580
```

Dengan pola ini, rollback lebih mudah dan Anda tidak perlu melakukan big-bang migration.

**Jangan menghapus:**

```text
db/
logs/
public/uploads/
database.sqlite
```

sebelum seluruh data/workflow legacy sudah dimigrasikan dan diverifikasi.

---

# ⚙️ Scaling Stream Worker

## 24. Scale Worker pada Satu Docker Host

Misalnya 3 replica:

```bash
docker compose -f docker-compose.saas.yml up -d --scale stream-worker=3 stream-worker
```

Cek:

```bash
docker compose -f docker-compose.saas.yml ps
```

Lalu lihat worker registry melalui API:

```bash
curl -fsS \
  -H "Authorization: Bearer $SHOLIDSTREAM_TOKEN" \
  http://127.0.0.1:7580/api/v1/workers
```

### Penting untuk `STREAM_WORKER_KEY`

Untuk Compose scaling pada satu host:

```env
STREAM_WORKER_KEY=
```

Biarkan kosong agar hostname container yang unik digunakan sebagai worker key.

Jika Anda memberikan nilai statis yang sama pada semua replica, beberapa worker dapat berebut identity yang sama.

Untuk worker dedicated per-host, gunakan key unik, contoh:

```env
STREAM_WORKER_KEY=jkt-worker-01
STREAM_WORKER_REGION=id-jkt
```

Server kedua:

```env
STREAM_WORKER_KEY=jkt-worker-02
STREAM_WORKER_REGION=id-jkt
```

---

## 25. Multi-Node Worker

Worker node membutuhkan akses private ke:

- PostgreSQL
- Redis/BullMQ
- object storage
- Internet/destination RTMP/RTMPS

Worker tidak memerlukan inbound public HTTP port.

Contoh `.env` pada worker eksternal:

```env
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@PRIVATE_POSTGRES:5432/sholidstream
DATABASE_SSL=true
REDIS_URL=redis://PRIVATE_REDIS:6379
QUEUE_PREFIX=sholidstream

DATA_ENCRYPTION_KEY=SAME_CONTROL_PLANE_KEY
DATA_ENCRYPTION_KEY_VERSION=v1

STORAGE_DRIVER=s3
S3_ENDPOINT=https://OBJECT-STORAGE-ENDPOINT
S3_REGION=REGION
S3_BUCKET=sholidstream
S3_ACCESS_KEY_ID=WORKER_ACCESS_KEY
S3_SECRET_ACCESS_KEY=WORKER_SECRET_KEY
S3_FORCE_PATH_STYLE=false

STREAM_WORKER_KEY=worker-jkt-01
STREAM_WORKER_REGION=id-jkt
STREAM_WORKER_CONCURRENCY=2
STREAM_WORKER_MAX_STREAMS=2
STREAM_WORKER_HEARTBEAT_MS=15000
STREAM_WORKER_LEASE_MS=45000
FFMPEG_PATH=/usr/bin/ffmpeg
```

Jalankan worker:

```bash
npm ci --omit=dev
npm run worker:start
```

Atau gunakan image Docker yang sama.

> `DATA_ENCRYPTION_KEY` harus konsisten pada component yang perlu decrypt secret/stream destination. Distribusikan melalui secret manager, bukan melalui Git/public file.

---

# 🎬 Worker Capacity

Jangan menentukan jumlah concurrent stream hanya dari RAM. FFmpeg encoding sangat dipengaruhi oleh:

- input codec
- output resolution
- FPS
- bitrate
- preset x264
- jumlah transform/filter
- CPU model
- hardware acceleration yang tersedia

Gunakan staging benchmark dengan profile yang sama seperti production.

Konfigurasi penting:

```env
STREAM_WORKER_CONCURRENCY=2
STREAM_WORKER_MAX_STREAMS=2
```

Mulai konservatif, pantau CPU/memory/stream health, lalu naikkan kapasitas secara bertahap.

---

# 💾 Object Storage

## 26. Development

Single process/local development boleh menggunakan:

```env
STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=./data/storage
```

## 27. Production / Multi-Worker

Gunakan:

```env
STORAGE_DRIVER=s3
```

Alasannya: filesystem container worker bersifat lokal dan tidak menjadi shared source of truth antar node.

Object key SholidStream ditulis dalam namespace workspace:

```text
workspaces/<workspaceId>/...
```

Gunakan bucket private dan least-privilege credential.

---

# 📺 YouTube Configuration

Environment foundation:

```env
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REDIRECT_URI=https://control.example.com/api/v1/integrations/youtube/callback
YOUTUBE_DAILY_QUOTA_BUDGET=10000
```

### Status Saat Ini

YouTube V2 sudah memiliki connection/token storage, client factory, channel service, live broadcast/liveStream binding, encryption, dan quota accounting foundation.

Namun seluruh OAuth callback/UI pada control plane baru **belum dianggap complete cutover**. Jika callback menghasilkan 404 atau belum tersedia pada UI, itu bukan masalah reverse proxy; route/application cutover masih perlu dilanjutkan.

Selama masa transisi, YouTube flow legacy dapat tetap dijalankan melalui legacy StreamFlow bridge jika fitur itu sudah bekerja pada instalasi Anda.

Jangan mencoba mengatasi quota dengan credential/project rotation yang melanggar kebijakan platform. Gunakan quota management dan request quota resmi.

---

# 💳 Entitlement / Billing

Default deployment disarankan:

```env
ENTITLEMENTS_ENFORCED=false
```

Aktifkan hanya setelah:

- plans tersedia,
- subscriptions tersedia,
- workspace memiliki entitlement yang benar,
- limit concurrent stream sudah divalidasi,
- billing/payment lifecycle Anda siap.

Jika diaktifkan terlalu awal, start stream dapat ditolak dengan error entitlement.

---

# 🔥 Firewall

Contoh UFW untuk host Nginx:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status verbose
```

Jangan `ufw allow` untuk:

```text
5432
6379
7580
9000
9001
```

kecuali ada kebutuhan private-network yang benar-benar Anda pahami.

Untuk worker, pastikan outbound connection ke destination streaming tidak diblokir.

---

# 🕐 Timezone & Waktu

Untuk distributed system, disarankan server menggunakan UTC:

```bash
sudo timedatectl set-timezone UTC
```

Cek:

```bash
timedatectl status
```

Simpan timezone user/schedule sebagai data aplikasi, jangan bergantung pada timezone host untuk distributed scheduler.

Jika masih menggunakan scheduler legacy StreamFlow, pastikan behavior timezone legacy juga diuji saat cutover.

---

# 📊 Monitoring

Minimal monitor:

- `/ready` availability
- control-plane process/container restart
- Redis health
- PostgreSQL health/connection pool
- worker heartbeat
- worker `status`
- `active_streams`
- `reserved_streams`
- CPU worker
- memory worker
- failed stream sessions
- recovery attempts
- expired leases
- object-storage availability
- disk usage PostgreSQL/Redis/MinIO

Endpoint:

```text
/live
/ready
/metrics
```

Initial SLO architecture target:

- control plane availability >= 99.9%
- cross-tenant data leakage = 0
- duplicate live ownership untuk session generation = 0
- expired worker lease terdeteksi dalam bounded watchdog interval

---

# 💾 Backup & Restore

## 28. Backup PostgreSQL

Buat direktori:

```bash
mkdir -p /opt/sholidstream-backups
chmod 700 /opt/sholidstream-backups
```

Backup:

```bash
docker compose -f docker-compose.saas.yml exec -T postgres \
  sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > /opt/sholidstream-backups/postgres-$(date +%F-%H%M%S).dump
```

Verifikasi file tidak kosong:

```bash
ls -lh /opt/sholidstream-backups/
```

---

## 29. Restore PostgreSQL

**Lakukan hanya setelah memahami dampaknya.** Stop component yang melakukan write jika restore penuh diperlukan.

Contoh:

```bash
docker compose -f docker-compose.saas.yml stop control-plane stream-worker
```

Restore dump:

```bash
cat /opt/sholidstream-backups/FILE.dump | \
docker compose -f docker-compose.saas.yml exec -T postgres \
  sh -lc 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists'
```

Kemudian:

```bash
docker compose -f docker-compose.saas.yml start control-plane stream-worker
```

Cek `/ready` dan logs.

---

## 30. Backup Object Storage

Untuk managed S3:

- aktifkan versioning jika sesuai kebutuhan,
- gunakan lifecycle/replication/backup provider,
- backup metadata PostgreSQL dan bucket harus memiliki retention policy yang konsisten.

Untuk MinIO self-hosted, gunakan `mc mirror`, replication, atau snapshot volume sesuai strategi infra Anda.

Jangan menganggap backup PostgreSQL sudah membackup media binary.

---

## 31. Backup Legacy

Selama legacy bridge masih dipakai, backup:

```text
db/
database.sqlite
public/uploads/
logs/ (opsional untuk forensic/debug)
.env
```

`SESSION_SECRET` dan `DATA_ENCRYPTION_KEY` juga harus masuk secure disaster-recovery secret backup.

---

# 🔄 Update & Rollback

## 32. Sebelum Update

Catat versi:

```bash
cd /opt/sholidstream
git rev-parse HEAD
```

Backup PostgreSQL.

Pastikan object storage sehat.

Cek working tree:

```bash
git status
```

---

## 33. Pull Update

```bash
git fetch origin
git pull --ff-only origin main
```

Build ulang:

```bash
docker compose -f docker-compose.saas.yml build --pull
```

Jalankan migration:

```bash
docker compose -f docker-compose.saas.yml run --rm migrate
```

Update services:

```bash
docker compose -f docker-compose.saas.yml up -d
```

Cek:

```bash
curl -fsS http://127.0.0.1:7580/live
curl -fsS http://127.0.0.1:7580/ready

docker compose -f docker-compose.saas.yml ps -a
docker compose -f docker-compose.saas.yml logs --tail=200 control-plane stream-worker
```

---

## 34. Worker Upgrade yang Lebih Aman

Worker memiliki graceful drain/shutdown behavior. Saat melakukan maintenance, hindari mematikan semua worker sekaligus jika ada stream aktif.

Untuk multi-host production:

1. tandai/drain worker,
2. tunggu session pindah/selesai,
3. upgrade worker,
4. start worker,
5. tunggu heartbeat healthy,
6. lanjut worker berikutnya.

Compose single-host sederhana tidak otomatis menjadi rolling orchestrator seperti Kubernetes; lakukan maintenance window jika hanya memiliki satu worker.

---

## 35. Rollback Code

Jika perlu rollback code ke commit sebelumnya:

```bash
git log --oneline -10
git checkout <COMMIT_SHA_SEBELUMNYA>
docker compose -f docker-compose.saas.yml build
docker compose -f docker-compose.saas.yml up -d
```

**Database migration saat ini tidak boleh dianggap memiliki automatic down migration.** Jika perubahan schema tidak backward-compatible, restore database dari backup yang dibuat sebelum upgrade.

Karena itu prinsip production:

```text
BACKUP -> MIGRATE -> DEPLOY -> HEALTH CHECK -> TRAFFIC
```

bukan:

```text
DEPLOY -> baru berharap rollback selalu aman
```

---

# 🧪 Pre-Go-Live Checklist

Sebelum traffic production:

- [ ] `.env` permission `600`
- [ ] `.env` tidak tracked Git
- [ ] `SESSION_SECRET` random dan tersimpan aman
- [ ] `DATA_ENCRYPTION_KEY` random dan tersimpan di disaster-recovery secret backup
- [ ] Password PostgreSQL default sudah diganti
- [ ] Password MinIO default sudah diganti
- [ ] PostgreSQL tidak public
- [ ] Redis tidak public
- [ ] MinIO API/Console tidak public
- [ ] Control plane hanya melalui HTTPS/reverse proxy
- [ ] `/saas` dilindungi admin access layer
- [ ] `/metrics` tidak public
- [ ] Bucket object storage sudah dibuat
- [ ] `STORAGE_DRIVER=s3` untuk multi-worker
- [ ] Migration selesai tanpa error
- [ ] `/live` = OK
- [ ] `/ready` = HTTP 200
- [ ] Minimal satu worker healthy terdaftar
- [ ] Worker unique identity tervalidasi
- [ ] Outbound RTMP/RTMPS dari worker berhasil
- [ ] FFmpeg test stream staging berhasil
- [ ] Backup PostgreSQL sudah diuji
- [ ] Backup object storage tersedia
- [ ] Legacy SQLite/upload backup tersedia selama cutover
- [ ] `ENTITLEMENTS_ENFORCED=false` sampai entitlement siap
- [ ] API key disimpan di secret manager
- [ ] Tidak ada plaintext stream key/token di config/log yang dipublikasikan
- [ ] Monitoring dan alert readiness tersedia
- [ ] NTP/time sync sehat
- [ ] DNS dan HTTPS certificate valid

---

# 🛠️ Troubleshooting

## Control Plane Tidak Start

Cek:

```bash
docker compose -f docker-compose.saas.yml logs --tail=300 control-plane
```

Penyebab umum:

- `DATA_ENCRYPTION_KEY` kurang dari 32 karakter
- `DATABASE_URL` salah
- PostgreSQL belum ready
- Redis URL salah
- migration belum selesai
- `.env` tidak terbaca

---

## `/ready` Mengembalikan 503

Cek PostgreSQL:

```bash
docker compose -f docker-compose.saas.yml exec postgres pg_isready -U sholidstream -d sholidstream
```

Cek Redis:

```bash
docker compose -f docker-compose.saas.yml exec redis redis-cli ping
```

Expected Redis:

```text
PONG
```

---

## Migration Gagal Authentication

Kemungkinan `DATABASE_URL` di `.env` tidak sama dengan credential `POSTGRES_PASSWORD` pada `docker-compose.saas.yml`.

Cek tanpa mempublikasikan password ke tiket/log publik.

---

## Worker Tidak Muncul di Registry

Cek:

```bash
docker compose -f docker-compose.saas.yml logs --tail=300 stream-worker
```

Pastikan:

- worker dapat connect PostgreSQL,
- worker dapat connect Redis,
- migration worker registry sudah diterapkan,
- `STREAM_WORKER_KEY` unik,
- clock server benar,
- container tidak restart loop.

---

## Worker Terdaftar tetapi Tidak Mendapat Stream

Periksa:

- worker status healthy,
- `active_streams`,
- `reserved_streams`,
- `max_streams`,
- region preference session,
- entitlement enforcement,
- queue prefix sama pada control plane dan worker,
- Redis yang digunakan sama,
- reservation tidak stale.

Gunakan:

```bash
curl -fsS \
  -H "Authorization: Bearer $SHOLIDSTREAM_TOKEN" \
  http://127.0.0.1:7580/api/v1/workers
```

---

## Error `NoSuchBucket` / S3 Bucket Tidak Ada

Pastikan bucket yang sama dengan:

```env
S3_BUCKET=sholidstream
```

sudah dibuat di MinIO/S3.

Pastikan credential memiliki permission ke bucket.

---

## Media Bisa Dibaca Control Plane tetapi Tidak Worker

Jika `STORAGE_DRIVER=local`, file berada di filesystem container tertentu.

Solusi production multi-worker:

```env
STORAGE_DRIVER=s3
```

Gunakan object storage yang dapat diakses seluruh worker.

---

## FFmpeg Gagal Start

Cek worker logs:

```bash
docker compose -f docker-compose.saas.yml logs --tail=500 stream-worker
```

Periksa:

- input media dapat diakses dari worker,
- destination URL RTMP/RTMPS valid,
- outbound firewall,
- DNS worker,
- bitrate/resolution profile,
- resource CPU/memory,
- destination stream key belum expired/rotated.

Docker image default memiliki FFmpeg di:

```text
/usr/bin/ffmpeg
```

---

## Semua Secret Tiba-tiba Gagal Didekripsi

Pastikan `DATA_ENCRYPTION_KEY` tidak berubah.

Jangan generate key baru pada setiap deploy.

`DATA_ENCRYPTION_KEY_VERSION` juga harus sesuai dengan ciphertext yang tersimpan.

Jika melakukan migrasi dari encryption legacy, simpan `LEGACY_SESSION_SECRET` lama hanya selama proses migrasi yang terkontrol.

---

## Start Stream Ditolak Entitlement

Jika platform belum memiliki provisioning billing lengkap:

```env
ENTITLEMENTS_ENFORCED=false
```

Restart control plane setelah mengubah config:

```bash
docker compose -f docker-compose.saas.yml restart control-plane
```

Jangan gunakan `false` sebagai permanent bypass setelah SaaS billing resmi diluncurkan; provision entitlement dengan benar lalu aktifkan enforcement.

---

## YouTube OAuth Callback 404

YouTube V2 saat ini adalah foundation service/domain dan belum seluruh callback/UI-nya dianggap cutover complete pada control plane.

Jangan mengubah Nginx secara acak untuk mengatasi 404 application route.

Gunakan legacy YouTube flow jika masih diperlukan sambil menyelesaikan route/UI cutover V2.

---

## Docker Build Lambat pada `sqlite3`

Dockerfile melakukan rebuild native `sqlite3` dari source untuk kompatibilitas image. Build pertama dapat lebih lama dibanding image yang tidak memiliki native dependency.

Gunakan build cache dan hindari menghapus cache tanpa kebutuhan.

---

# 🧭 Progressive Cutover yang Direkomendasikan

Urutan release production:

```text
1. Deploy PostgreSQL / Redis / Object Storage
2. Jalankan migrations
3. Deploy Control Plane tanpa public traffic
4. Deploy 1 Worker
5. Verifikasi /live + /ready + worker heartbeat
6. Uji staging RTMP/RTMPS
7. Uji storage end-to-end
8. Deploy worker tambahan
9. Backup legacy SQLite + uploads
10. Migrasikan workflow/data per-domain
11. Jalankan legacy + SaaS berdampingan
12. Pindahkan traffic sedikit demi sedikit
13. Pantau incidents/recovery/worker capacity
14. Setelah feature parity tervalidasi, retire legacy
```

Jangan langsung menghapus `app.js`/SQLite pada hari pertama deployment SaaS.

---

# 🧑‍💻 Manual Deployment Tanpa Docker

Untuk development/staging khusus, Anda dapat menjalankan process langsung.

Requirement:

- Node.js 20
- FFmpeg
- PostgreSQL
- Redis
- S3-compatible storage atau local storage

Install dependency:

```bash
npm ci
```

Migration:

```bash
npm run db:migrate
```

Control Plane:

```bash
npm run control:start
```

Worker:

```bash
npm run worker:start
```

Legacy app:

```bash
npm start
```

Untuk production non-Docker gunakan systemd/PM2/supervisor yang memiliki auto-restart, log management, startup ordering, dan graceful SIGTERM.

---

# 🧪 Test Suite

Full test:

```bash
npm test
```

Platform test:

```bash
npm run test:platform
```

Worker test:

```bash
npm run test:worker
```

Baseline regression guard:

```bash
npm run test:baseline
```

Sebelum deployment production, jangan hanya mengandalkan unit/contract tests. Tambahkan staging validation menggunakan real media dan destination RTMP/RTMPS yang Anda miliki izin untuk gunakan.

---

# 🔒 Security Notes

- Gunakan HTTPS untuk seluruh API publik.
- Jangan log bearer API key.
- Jangan log stream key/output URL plaintext.
- Jangan commit `.env`.
- Simpan `DATA_ENCRYPTION_KEY` di secret manager.
- Gunakan object storage private.
- PostgreSQL dan Redis harus berada di private network.
- Jangan expose MinIO console publik.
- Scope API key customer hanya sesuai kebutuhan.
- Platform-admin API key jangan dipakai oleh frontend/customer application.
- Rotasi credential harus dirancang tanpa menghilangkan kemampuan decrypt ciphertext lama sebelum re-encryption selesai.
- Batasi SSH.
- Patch OS, Docker, dan dependency secara berkala melalui maintenance process yang diuji.

---

# 📚 Migration / Architecture Docs

Dokumentasi transformasi tersedia di:

```text
docs/migration/
```

Termasuk baseline, test matrix, modularization, PostgreSQL, tenancy, worker extraction, worker registry, distributed scheduler, watchdog/failover, YouTube V2, billing, automation, API/admin, dan production hardening.

---

# 📄 License & Upstream Attribution

Project ini berasal dari dan mempertahankan atribusi terhadap **StreamFlow** oleh Bang Tutorial, yang didistribusikan dengan lisensi MIT.

Original upstream:

```text
https://github.com/bangtutorial/streamflow
```

SholidStream mempertahankan license/permission notice sesuai ketentuan MIT License. Lihat [LICENSE.md](LICENSE.md).

---

## Production Command Cheat Sheet

```bash
# Validasi config
docker compose -f docker-compose.saas.yml config

# Build
docker compose -f docker-compose.saas.yml build --pull

# Start infrastructure
docker compose -f docker-compose.saas.yml up -d postgres redis minio

# Migration
docker compose -f docker-compose.saas.yml run --rm migrate

# Start platform
docker compose -f docker-compose.saas.yml up -d control-plane stream-worker

# Status
docker compose -f docker-compose.saas.yml ps -a

# Health
curl -fsS http://127.0.0.1:7580/live
curl -i http://127.0.0.1:7580/ready

# Logs
docker compose -f docker-compose.saas.yml logs -f --tail=200 control-plane stream-worker

# Scale worker
docker compose -f docker-compose.saas.yml up -d --scale stream-worker=3 stream-worker

# Re-run migration
docker compose -f docker-compose.saas.yml run --rm migrate

# Stop SaaS stack
docker compose -f docker-compose.saas.yml down

# Jangan pakai -v saat stop production kecuali Anda memang ingin menghapus volume data.
```

> **PERINGATAN:** `docker compose down -v` dapat menghapus named volumes PostgreSQL, Redis, dan MinIO. Jangan gunakan `-v` pada production tanpa backup dan niat eksplisit untuk menghancurkan data.
