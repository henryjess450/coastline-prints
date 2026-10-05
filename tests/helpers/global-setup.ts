import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

/** Fresh SQLite test database with all migrations applied. */
export default function setup() {
  rmSync("test.db", { force: true });
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: "file:./test.db" }, stdio: "pipe" });
  return () => {
    rmSync("test.db", { force: true });
    rmSync("storage-test", { recursive: true, force: true });
  };
}
