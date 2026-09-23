/**
 * One-time Google OAuth helper. Run once per inbox; prints a refresh token to
 * store as a Worker secret.
 *
 *   npm run auth:google              # work inbox
 *   npm run auth:google -- personal  # personal inbox
 *
 * The token is written to .secrets/ rather than printed, so it can be piped
 * into wrangler without ever appearing on screen.
 *
 * Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, and
 * http://localhost:8788/callback registered as an authorised redirect URI on
 * the OAuth client in Google Cloud Console.
 */

import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GMAIL_SCOPES } from "../src/gmail.ts";

const PORT = 8788;
const REDIRECT = `http://localhost:${PORT}/callback`;

// Which inbox this run is for, so the token lands in a predictable file:
//   npm run auth:google            -> work
//   npm run auth:google -- personal
const LABEL = process.argv[2] === "personal" ? "personal" : "work";
const SECRET_NAME = `GMAIL_REFRESH_TOKEN_${LABEL.toUpperCase()}`;

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", ".secrets", `gmail-${LABEL}.txt`);

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "\nGOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.\n\n" +
      "Create them at console.cloud.google.com → APIs & Services →\n" +
      "Credentials → Create OAuth client ID → Web application, with\n" +
      `${REDIRECT} as an authorised redirect URI.\n`,
  );
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    // offline + consent together are what actually return a refresh token;
    // without prompt=consent Google omits it on repeat authorisations.
    access_type: "offline",
    prompt: "consent",
  });

console.log(
  `\nOpen this in the browser, signed in as the account you are connecting:\n\n${authUrl}\n`,
);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end("not found");
    return;
  }

  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  if (error || !code) {
    res.writeHead(400).end(`Authorisation failed: ${error ?? "no code"}`);
    console.error(`\nAuthorisation failed: ${error ?? "no code returned"}\n`);
    server.close();
    process.exit(1);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });

  const json = (await response.json()) as {
    refresh_token?: string;
    error_description?: string;
  };

  if (!response.ok || !json.refresh_token) {
    res.writeHead(500).end("Token exchange failed — see the terminal.");
    console.error(
      `\nToken exchange failed: ${json.error_description ?? response.status}\n`,
    );
    server.close();
    process.exit(1);
  }

  res
    .writeHead(200, { "content-type": "text/html" })
    .end("<p>Done. Close this tab and return to the terminal.</p>");

  // Deliberately never printed. A token on screen ends up in scrollback,
  // in screenshots, and pasted into chats; a file can be piped straight
  // into wrangler without a human ever seeing it.
  mkdirSync(dirname(outPath), { recursive: true, mode: 0o700 });
  writeFileSync(outPath, json.refresh_token, { mode: 0o600 });

  console.log(
    `\nRefresh token for the ${LABEL} inbox saved to:\n  ${outPath}\n\n` +
      `Upload it without displaying it:\n\n` +
      `  npx wrangler secret put ${SECRET_NAME} < ${outPath}\n\n` +
      `Then delete the local copy:\n\n` +
      `  rm ${outPath}\n\n` +
      `It grants read access to that mailbox. Do not cat it, screenshot it,\n` +
      `or paste it anywhere — treat it like a password.\n`,
  );

  server.close();
});

server.listen(PORT, () =>
  console.log(`Waiting for the redirect on ${REDIRECT} …`),
);
