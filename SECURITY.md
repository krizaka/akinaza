# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/krizaka/akinaza/security/advisories/new) or by e-mail to
**security@krizaka.com**. Do not open a public issue. We acknowledge reports within 72 hours.

## Security model (summary)

- **Accounts**: created by an operator; sign-up is closed by the server (`AUTH_SIGNUP_ENABLED`). Passwords hashed with
  scrypt; a wrong address and a wrong password get the same answer after the same work; sign-in is rate-limited.
- **Sessions**: a random token in an HttpOnly, Secure, SameSite=Lax cookie; the database keeps only its keyed hash.
- **A shop's data**: visible to that shop only; kept in Canada, encrypted at rest; client consent per purpose (Loi 25);
  erasure on request, keeping only the invoices tax law requires.
- **Integrity**: issued invoices, the tax ledger and consents are append-only, and invoices must balance their ledger
  entries at commit — enforced by the database, not only the application.
- **AI**: the tax assistant runs on Orazaka with Akinaza's service key, its outputs checked against a contract and
  reconciled with the ledger. Nothing is filed or transmitted to a government.
- **Administration**: a session, the ADMIN role and an allowed IP address (none in production by default).
- **HTTP**: Content-Security-Policy `default-src 'self'`, HSTS, `nosniff`, `frame-ancestors 'self'`.
