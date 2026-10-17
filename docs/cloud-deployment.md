# CrashLine on EC2 with Neon PostgreSQL

Deployment target: `https://crashline.manv.blog` (UI and API) and
`https://crashline-mcp.manv.blog/mcp` (authenticated insurance MCP).
Both addresses passed public HTTPS health checks on 17 October 2026. The API
reports Neon connected. Hosted UI routes, authentication boundaries, MCP tool
discovery, and ElevenLabs signed session creation also passed. The replacement
ArmorIQ entry `insurance-mcp-cloud` routes to the permanent MCP URL. A hosted
policy lookup reached the handler through ArmorIQ, and a declared settlement
action was blocked by remote policy with zero handler invocations. The old
`insurance-mcp` entry remains because provider updates return HTTP 500 and its
dashboard refuses deletion. A real spoken call is still required.

ArmorIQ's proxy intermittently returned HTTP 500 (`Internal Proxy Error`)
during hosted verification. The gateway retries such HTTP 5xx failures once
with the exact same signed request and operation ID. MCP execution receipts
prevent duplicate mutations. Policy blocks, holds, and unverified responses
are not treated as successful execution; an exhausted retry remains unavailable.
Local validation passed 46 tests, typechecking, and the 100-line function limit.
The fresh hosted workflow subsequently passed all seven allowed tool executions,
duplicate draft replay, correction, unconfirmed/stale confirmation rejection,
both Gemini specialists, and HTTPS event streaming. Its complete report is
pending human review; `docs/hosted-live-evidence.json` records the real IDs.
The save-report call recovered from an actual proxy HTTP 500 using the bounded
retry. This was an automated synthetic webhook test, not a spoken call.

The current target selected by the owner is a `t3.micro` (1 GB RAM) with a
20 GB root disk. For this constrained demo, add 4 GB swap and transfer the
already-built AMD64 Docker image instead of compiling on the instance. Neon
hosts PostgreSQL; the cloud Compose file starts no database container. Use small
Prisma connection pools in the pooled URL.
Validate memory usage and a full call on the actual host before submission.

## Console setup

Use the AWS account's Billing / Free Tier / Credits pages to confirm eligibility.
The instance's "Free tier eligible" label alone does not prove zero cost.
Confirm the estimate for compute, EBS storage, and public IPv4 before launch.

Create one Ubuntu 24.04 LTS **x86_64** EC2 instance, or **ARM64** when choosing
the `t4g.small` compute trial. Prefer at least 2 GB RAM
for the database and three Bun processes; a 1 GB instance is a constrained option
that needs swap and should use a prebuilt image. Choose the region supported by
your account and credits. Set a descriptive name such as `crashline-demo`.

AWS currently advertises up to 750 monthly `t4g.small` compute hours through
31 December 2026: https://aws.amazon.com/ec2/instance-types/t4/ . This does not
make storage, public IPv4, or surplus CPU credits free. Verify the account's
remaining trial usage and launch estimate. Select CPU credit **Standard** mode
for a burstable trial instance if avoiding surplus CPU charges is the priority;
the instance can then be throttled when credits run out. The Bun base image
publishes both AMD64 and ARM64 variants. Build natively on the selected instance;
do not copy an AMD64-only local image onto an ARM host. Local validation is AMD64,
so ARM64 runtime still needs validation on the chosen instance.

Allow inbound TCP 80 and 443 publicly. Allow SSH 22 only from your own IP.
Do not expose PostgreSQL or ports 4000–4002. Require IMDSv2.
Use EC2 Instance Connect or your own SSH key to connect; never put private keys
or provider credentials into EC2 user data or the public repository.

The owner selected the current public IPv4 `54.226.14.81` for this demo instead
of an Elastic IP. Keep the instance running through 21 October: stopping and
starting it can change that address and require updating these DNS records.
The application URLs remain the custom domain names. Public IPv4 usage can
cost money; check your allowance.
At the domain's DNS provider, create **only** these new records:

```
A  crashline      54.226.14.81
A  crashline-mcp  54.226.14.81
```

Leave the personal site's existing records unchanged. The domain's nameservers
are `apollo.dns-parking.com` and `athena.dns-parking.com` as checked on 17 October.

## Prepare the host

For a new Ubuntu instance, install Docker Engine, Compose v2, and Git using the
supported Ubuntu/Docker packages, then ensure Docker starts on boot. This demo
expects `docker compose` to be available. Clone the repository:

```sh
git clone https://github.com/Manav2209/crashline.git
cd crashline
cp .env.cloud.example .env.cloud
chmod 600 .env.cloud
```

Fill `.env.cloud` privately on the instance. Use the existing integration keys,
agent ID, MCP bearer token, webhook secret, and internal token consistently.
Create a dedicated Neon database. Set `DATABASE_URL` to its pooled connection
string and `MIGRATION_DATABASE_URL` to its direct connection string, retaining
`sslmode=require`. Add `connection_limit=3&connect_timeout=15&pool_timeout=15` to
the pooled URL. The direct URL is used only by the migration/seed service.
Set a strong demo access token and give judges access through private submission instructions.
The token is entered on the app's Connection settings page and is never baked
into the JavaScript bundle. This is one shared synthetic demo workspace.

The Compose file supplies each service's Neon connection and the internal orchestrator URL.
It exposes only Caddy's HTTP/HTTPS ports. Keep one API replica because event
stream tickets are currently held in memory.

Build once, then start all services:

```sh
sudo docker compose --env-file .env.cloud -f docker-compose.cloud.yml build api
sudo docker compose --env-file .env.cloud -f docker-compose.cloud.yml up -d --no-build
sudo docker compose --env-file .env.cloud -f docker-compose.cloud.yml ps -a
```

The migration service applies committed Prisma migrations to Neon and
idempotently seeds the synthetic account/policy. Inspect schema metadata first;
never reset a populated database to get past a migration error. Caddy obtains
HTTPS certificates after DNS resolves and ports 80/443 are reachable. Its
volumes preserve certificates. Claims are stored in Neon independently of the
EC2 instance; confirm the selected Neon plan remains active through judging.

## Connect providers after HTTPS works

1. Verify both public `/health` endpoints. API health must report a connected DB.
2. Configure the **existing** ElevenLabs agent for the stable API URL, preserving
   tool IDs and sender secret. The existing local `.voice-state.json` receipt must
   be reused when running `bun run voice:configure`; starting with no receipt can
   create duplicate tools. Do not upload provider keys to Git.
3. Copy the resulting receipt's one-line JSON into the private
   `VOICE_CONFIGURATION_JSON` value in `.env.cloud` (single-quote the JSON).
   Restart the API container after changing it. Readiness checks require the
   receipt's agent ID, API URL, and all three tool IDs to match.
4. Set `ARMORIQ_MCP_NAME=insurance-mcp-cloud` and use the agent ID returned by
   the successful replacement registration. It uses the same bearer token and
   seven allowed / two denied tool aliases. The owner authorized replacement
   after the old entry could not be updated or deleted. Preserve that stale
   entry until the provider can remove it; CrashLine no longer routes to it.
   A saved dashboard value is not proof: verify a fresh allowed call reaches
   the hosted handler and a real remote policy denial reaches no handler.
5. Confirm the rules actually appear and apply in the required ArmorTools
   Policy Studio account. Do not assume the SDK registration and Pro console
   are linked just because both sign-ins work.

## Acceptance before submission

- Open the hosted app on another device; enter the demo token in Settings.
- Start a fresh synthetic intake and complete a real spoken ElevenLabs call.
- Verify policy lookup, draft correction, explicit confirmation, submission,
  specialist investigation, and the persisted report pending human review.
- Run a fresh forbidden-action diagnostic through ArmorIQ and verify
  `ARMORIQ_POLICY`, `BLOCK`, `executed: false`, and zero MCP handler invocations.
  A voice refusal or SDK plan rejection alone is not that evidence.
- Reload a claim deep link and confirm the event stream works through HTTPS.
- Keep the instance, DNS, keys, and services available through 21 October 2026.

Implementation: `Dockerfile`, `docker-compose.cloud.yml`, and `deploy/Caddyfile`.
The owner created the EC2 instance in the AWS Console. The application services
and Caddy are deployed there; PostgreSQL is hosted separately in Neon.

References: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html
and https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html
