import crypto from "node:crypto";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });
const password = await rl.question("Password to hash: ");
rl.close();

const salt = crypto.randomBytes(16).toString("hex");
const n = 131072;
const r = 8;
const p = 1;
const key = crypto.scryptSync(password, salt, 64, { N: n, r, p }).toString("hex");

console.log(`scrypt:${n}:${r}:${p}:${salt}:${key}`);
