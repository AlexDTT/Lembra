# Security

Security fixes target the latest code on the default branch. Older snapshots are not maintained as separate releases.

Please report vulnerabilities privately through this repository's GitHub **Security → Report a vulnerability** option when enabled. If it is unavailable, ask a maintainer to enable private reporting without posting vulnerability details. Do not open a public issue containing credentials, private records or an exploitable vulnerability.

Include the affected revision, a minimal reproduction using synthetic data, expected and actual behavior, and impact. Do not test against someone else's deployment or submit real health or financial records.

Deployment owners must configure their own credentials, allowed email addresses, OAuth redirects and backups. Frontend publishable keys are public; service-role keys, Google refresh tokens, private VAPID keys and cron secrets belong only in server-side configuration. Keep production backups in a private repository or private storage.
