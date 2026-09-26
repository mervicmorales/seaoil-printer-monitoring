import { chmod, copyFile, mkdir, readdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const privateRoot = process.env.PRIVATE_UPLOAD_DIR?.trim() || path.join(root, "storage", "uploads");
const filenamePattern = /^[a-f\d-]{36}\.[a-z\d]{1,8}$/i;
const copyOnly = process.argv.includes("--copy");

for (const kind of ["contracts", "repair-resolutions"]) {
  const sourceDir = path.join(root, "public", "uploads", kind);
  let names;
  try {
    names = await readdir(sourceDir);
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  const destinationDir = path.join(privateRoot, kind);
  await mkdir(destinationDir, { recursive: true, mode: 0o700 });
  await chmod(destinationDir, 0o700);
  let moved = 0;
  for (const name of names) {
    if (!filenamePattern.test(name)) continue;
    const source = path.join(sourceDir, name);
    const destination = path.join(destinationDir, name);
    try {
      await stat(destination);
      throw new Error(`Private upload already exists: ${kind}/${name}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (copyOnly) {
      await copyFile(source, destination, 1);
    } else {
      try {
        await rename(source, destination);
      } catch (error) {
        if (error.code === "EEXIST") {
          throw new Error(`Private upload already exists: ${kind}/${name}`);
        }
        if (error.code !== "EXDEV") throw error;
        await copyFile(source, destination, 1);
        await unlink(source);
      }
    }
    await chmod(destination, 0o600);
    moved += 1;
  }
  console.log(`${kind}: ${copyOnly ? "copied" : "moved"} ${moved} upload(s) into private storage`);
}
