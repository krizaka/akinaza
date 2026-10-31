// The journeys' own mailbox: the provider's « send a message » call, kept in memory (never logged: a mail may hold a code).
import { createServer } from "node:http";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function testMailbox(port) {
  const mails = [];
  let server;
  const until = async (find) => {
    for (let i = 0; i < 60; i += 1) {
      const found = find();
      if (found) return found;
      await wait(250);
    }
    return null;
  };
  return {
    mails,
    async start() {
      server = createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          const form = new URLSearchParams(body);
          mails.push({ to: form.get("to") ?? "", text: form.get("text") ?? "" });
          res.writeHead(200, { "content-type": "application/json" }).end("{}");
        });
      });
      await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
    },
    stop: () => server?.close(),
    /** The 6-digit code of the last mail to this address, or null. */
    codeFor: (to) => until(() => /\b(\d{6})\b/.exec(mails.filter((m) => m.to === to).at(-1)?.text ?? "")?.[1]),
    /** The receipt: the mail to this address that carries no code. */
    receiptFor: (to) => until(() => mails.find((m) => m.to === to && !/\b\d{6}\b/.test(m.text))),
  };
}
