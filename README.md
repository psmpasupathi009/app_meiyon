# MEIYON Office Portal

Law-office portal on **http://localhost:3002**. Owns the shared Prisma schema and seed.

| Site | Local | Repo |
|------|-------|------|
| Marketing | :3000 | `meiyon` |
| PSM Admin | :3001 | `psm_admin` |
| Office Portal | :3002 | this repo |

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:push
npm run db:seed          # plans + super admin + MEIYON product (no demo office)
npm run db:purge-demo    # remove leftover demo-chamber if present
npm run dev
```

Seed does **not** create demo offices, fake cases, or a default PIN.
