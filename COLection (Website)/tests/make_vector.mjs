// Makes tests/licence_vector.json: a licence signed by the SERVER code with a fixed throw-away key. The program's own tests (in
// the program folder: tests/test_licence_web.py) read it and check the program accepts it, so the two languages cannot drift apart.
// Run:  npm run vector   then copy tests/licence_vector.json to the program's tests/data/ folder.
import crypto from "node:crypto";
import fs from "node:fs";
import { signLicence } from "../server/worker.mjs";

const seed = crypto.createHash("sha256").update("colection test vector, not a real key").digest();       // 32 fixed bytes
const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]);
const publicKey = crypto.createPublicKey(crypto.createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" }))
  .export({ format: "der", type: "spki" }).subarray(-32);
const details = { org: "Carlton Netball Club – café \"quote\"", plan: "club", voters: 250, issued: "2026-10-15", expires: "2027-10-15", id: "W-TESTVECT" };
const licence = await signLicence(details, seed.toString("base64url"), "web");
fs.writeFileSync(new URL("./licence_vector.json", import.meta.url), JSON.stringify({
  note: "Made by tests/make_vector.mjs. The key is a published throw-away: it signs nothing real.",
  public_key: publicKey.toString("base64url"), licence, details }, null, 1) + "\n");
console.log("written");
