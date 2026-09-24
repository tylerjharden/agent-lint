import { createServer } from "node:http";

const port = Number(process.env.AGENT_LINT_PERF_PORT);
if (!Number.isInteger(port) || port < 1) {
  process.exit(2);
}

createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("ok");
}).listen(port, "127.0.0.1");
