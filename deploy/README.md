# Hosting the storybook at home

The site is static — one HTML file plus images. Anything that can serve a folder works.

## Option A · add it to the Caddy you already run (recommended)

Clone the repo somewhere the server can read it:

```bash
git clone https://github.com/<you>/tomato-vs-lettuce.git /srv/www/tomato-vs-lettuce
```

Then add one block to your Caddyfile.

**Own subdomain** (DuckDNS wildcard or a real domain — Caddy gets the certificate itself):

```caddyfile
tomato.example.duckdns.org {
	root * /srv/www/tomato-vs-lettuce
	file_server
	encode zstd gzip
}
```

**Or a path under a site you already serve:**

```caddyfile
example.duckdns.org {
	handle_path /storybook/* {
		root * /srv/www/tomato-vs-lettuce
		file_server
	}
	# ... your existing handles
}
```

Reload without dropping anything else:

```bash
caddy reload --config /etc/caddy/Caddyfile      # host install
docker exec -w /etc/caddy caddy caddy reload    # Caddy in Docker
```

If Caddy runs in Docker, the folder has to be mounted into the container — add
`- /srv/www/tomato-vs-lettuce:/srv/www/tomato-vs-lettuce:ro` to its volumes first.

## Option B · its own container

```bash
cd deploy && docker compose up -d
```

Serves on `http://<server>:8088`. Put it behind your existing Caddy later with
`reverse_proxy localhost:8088` if you want HTTPS.

## Who can reach it

- **Tailscale only** — no port forwarding, no DNS. Anyone on your tailnet opens
  `http://<machine-name>:8088`. With Tailscale Serve you get HTTPS too:
  `tailscale serve --bg 8088`
- **Public** — point the DuckDNS name at your IP, forward 80/443 to the server,
  and Caddy handles the certificate. Only do this if you're fine with the drawings
  being on the open internet.

## Updating

```bash
cd /srv/www/tomato-vs-lettuce && git pull
```

No build step, no restart needed — the files are read on each request.
