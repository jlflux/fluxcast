/**
 * List or delete every LiveKit ingress on the project.
 *
 * LiveKit meters an ingress for as long as it exists. This is the blunt
 * instrument for when one is stuck, orphaned, or reporting "publishing" with no
 * encoder attached — the cases the admin UI cannot always reach.
 *
 *   node --env-file=.env.local scripts/ingress.mjs            # list
 *   node --env-file=.env.local scripts/ingress.mjs --delete-all
 *
 * Reads LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET from the environment.
 */
import { IngressClient } from "livekit-server-sdk";

const STATE = {
  0: "inactive",
  1: "buffering",
  2: "publishing",
  3: "error",
  4: "complete",
};

function httpUrl(value) {
  return String(value ?? "")
    .trim()
    .replace(/^ws(s)?:\/\//, (_m, s) => (s ? "https://" : "http://"))
    .replace(/\/+$/, "");
}

const url = httpUrl(process.env.LIVEKIT_URL);
const key = process.env.LIVEKIT_API_KEY?.trim();
const secret = process.env.LIVEKIT_API_SECRET?.trim();

if (!url || !key || !secret) {
  console.error(
    "Missing LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET.\n" +
      "Run with:  node --env-file=.env.local scripts/ingress.mjs",
  );
  process.exit(1);
}

const client = new IngressClient(url, key, secret);
const deleteAll = process.argv.includes("--delete-all");

const all = await client.listIngress({});

if (all.length === 0) {
  console.log("No ingresses exist on this project. Nothing is being metered.");
  process.exit(0);
}

console.log(`${all.length} ingress${all.length === 1 ? "" : "es"} on ${url}:\n`);
for (const i of all) {
  const state = STATE[i.state?.status] ?? "unknown";
  console.log(`  ${i.ingressId}  ${state.padEnd(11)} ${i.name || i.roomName || "(unnamed)"}`);
}

if (!deleteAll) {
  console.log(
    `\nEvery one of these is billing for as long as it exists.\n` +
      `To delete them all:  node --env-file=.env.local scripts/ingress.mjs --delete-all`,
  );
  process.exit(0);
}

console.log("\nDeleting all...\n");
let ok = 0;
const failed = [];
for (const i of all) {
  try {
    await client.deleteIngress(i.ingressId);
    console.log(`  deleted ${i.ingressId}`);
    ok += 1;
  } catch (error) {
    console.error(`  FAILED  ${i.ingressId}: ${error instanceof Error ? error.message : error}`);
    failed.push(i.ingressId);
  }
}

const remaining = await client.listIngress({});
console.log(`\nDeleted ${ok}. Remaining on the project: ${remaining.length}.`);
if (failed.length > 0) {
  console.log(`Could not delete: ${failed.join(", ")}`);
  process.exit(1);
}
