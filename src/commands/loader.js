import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function registerCommands(bot) {
  const files = fs.readdirSync(__dirname)
    .filter((file) => file.endsWith(".js") && file !== "loader.js" && file !== "index.js" && !file.startsWith("_"))
    .sort();

  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(__dirname, file)).href);
    const handler = mod.default || mod.register;
    if (typeof handler === "function") {
      await handler(bot);
    } else {
      console.warn("[commands] skipped", { file });
    }
  }
}
