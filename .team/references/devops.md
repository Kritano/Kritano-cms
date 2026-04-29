# DevOps References

## Local Development
- Docker Compose for Postgres + Redis only
- Bun API server with hot reload on localhost:3000
- Astro dev server on localhost:4321
- Admin served from API server at localhost:3000/admin

## Production
- **No Docker in production** — plain Linux server
- **Process management:** systemd (cms-api.service, cms-worker.service)
- **Web server:** nginx (SSL termination, reverse proxy, static files)
- **SSL:** Let's Encrypt via certbot
- **Deployment:** Single generated bash script from admin UI
- **Supported OS:** Ubuntu 22.04, Ubuntu 24.04, Debian 12
- **Security:** ufw firewall, fail2ban, Postgres bound to localhost only

## CI/CD
- Monorepo with Bun workspaces
- GitHub-hosted under kritano org
- PR template with docs checklist
