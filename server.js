const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.argv[2] || 4173);

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("Invalid port");
}

const routes = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/math.js", ["math.js", "text/javascript; charset=utf-8"]],
]);

const server = http.createServer((request, response) => {
  const pathname = new URL(
    request.url || "/",
    `http://${request.headers.host || "127.0.0.1"}`
  ).pathname;

  const route = routes.get(pathname);

  if (!route) {
    response.writeHead(404, {
      "content-type": "text/plain; charset=utf-8",
    });
    response.end("Not found");
    return;
  }

  const [filename, contentType] = route;

  fs.readFile(path.join(__dirname, filename), (error, data) => {
    if (error) {
      response.writeHead(500, {
        "content-type": "text/plain; charset=utf-8",
      });
      response.end("Server error");
      return;
    }

    response.writeHead(200, { "content-type": contentType });
    response.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`CONTROL_TASK_V1 server listening on ${port}`);
});
