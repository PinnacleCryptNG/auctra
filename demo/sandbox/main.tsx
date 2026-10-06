import { createRoot } from "react-dom/client";
import { SandboxApp } from "./app";
import { boot, initClaude, installFetch } from "./engine";

const root = createRoot(document.getElementById("root")!);
const status = document.getElementById("boot-status")!;

installFetch();
initClaude();
boot("BUSINESS")
  .then(() => {
    document.getElementById("boot")?.remove();
    root.render(<SandboxApp />);
  })
  .catch((error) => {
    console.error(error);
    status.textContent = `The sandbox couldn't start its in-browser database: ${(error as Error).message ?? error}`;
  });
