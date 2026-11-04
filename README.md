# Hawkr

A hawker centre management app with four roles — customer, vendor, operator and NEA officer —
served by one Express API and a static front end.

## Prerequisites

- **Node.js 18+** (developed on v24)
- **SQL Server** (Express is fine) with:
  - **Mixed Mode authentication** enabled — the app signs in as a SQL login, not Windows auth
  - **TCP/IP enabled on port 1433** (SQL Server Configuration Manager → Network Configuration)
- `sqlcmd` or SQL Server Management Studio

## 1. Build the database

Everything is in one script at the project root. It **drops and recreates** `HawkerDatabase`,
creates the `hawker_user` login, builds every table and loads the sample data.

```bash
sqlcmd -S localhost\SQLEXPRESS -E -b -I -i masterDBSetup.sql
```

The `-I` flag matters. Without it a filtered index later in the script makes every write
fail with `Msg 1934`. SSMS sets that option itself, so opening the file and hitting
**Execute** works too.

## 2. Create `.env`

`.env` is gitignored, so make your own in the project root:

```
DB_USER=hawker_user
DB_PASSWORD=hawker123
DB_SERVER=localhost
DB_DATABASE=HawkerDatabase
PORT=3000
JWT_SECRET=replace_this_with_a_long_random_string
```

The credentials match the login `masterDBSetup.sql` creates. Set `JWT_SECRET` to any long
random string — it signs the login tokens.

If your SQL Server listens on a different port, add `DB_PORT=...`. Note there is no named
instance setting: the app connects to `DB_SERVER` on a port, so `localhost\SQLEXPRESS` will
not work as a value.

## 3. Install and run

```bash
npm install
npm start        # or: npm run dev   (nodemon)
```

Then open **<http://localhost:3000/auth/login.html>**.

That page is the single sign-in for all four roles and sends you to the right home screen.
(`http://localhost:3000/` on its own just returns an API health check, and
`/api-docs` serves the Swagger docs.)

## Logins

Every seeded account uses the same password:

```
Password123!
```

| Username | userId | Role | Lands on |
|---|---|---|---|
| `johncustomer` | 4 | customer | Customer app — browse, order, favourites, stall reviews, hawker centre feedback |
| `marycustomer` | 6 | customer | Second customer |
| `davidcustomer` | 7 | customer | Third customer |
| `sarahcustomer` | 8 | customer | Fourth customer |
| `jamescustomer` | 9 | customer | Fifth customer |
| `ahhockvendor` | 1 | vendor | Vendor dashboard — menu, stock, promotions, orders, rental |
| `lormeevendor` | 2 | vendor | A second vendor, for checking data isolation |
| `rojakvendor` | 3 | vendor | Has a pending stall request for the operator to approve |
| `operator1` | 10 | operator | Operator app — assigned to all five centres |
| `neaofficer` | 5 | nea | Inspections, grading, grade history |

The `userId` matters when calling the API directly — many routes are scoped to it, like
`/vendor/1/dashboard`.

**Continue as Guest** on the login page needs no account — it browses the customer app
with a temporary token from `POST /user/guest`.

Anyone you register through the sign-up page keeps their own password; only the ten
accounts above are reset by the setup script.

### Calling the API directly

```bash
curl -X POST http://localhost:3000/user/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ahhockvendor","password":"Password123!"}'
```

That returns a JWT. Send it as `Authorization: Bearer <token>` on every protected route.
Tokens last one hour.

### Changing the seeded password

The bcrypt hashes in the sample data are real, but the plaintext behind them was never
recorded — which is why the setup script resets these ten accounts to a known password in
section 27 of `masterDBSetup.sql`. To use a different one, generate a hash and swap it into
that section:

```bash
node -e "console.log(require('bcryptjs').hashSync('YourNewPassword', 10))"
```

## Troubleshooting

**`Database connection failed` on startup.** The server only listens after SQL Server
answers, so nothing loads. Check TCP/IP is on and port 1433 is listening, that Mixed Mode
auth is enabled, and that the `.env` credentials match.

**`Msg 1934` while running the setup script.** You left off `-I`. Re-run with it.

**Signed in, but pages are empty and the console shows 401s.** Tokens expire after an
hour. Sign in again.

**A page shows "Route not found" for an endpoint you know exists.** Express registers
routes once at startup, so a running server never picks up new ones. Stop it and start
it again after pulling changes.
