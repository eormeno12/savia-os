import "dotenv/config";
import Fastify from "fastify";
import { chatRoute } from "./routes/chat.js";
import { cleanupRoute } from "./routes/cleanup.js";
import { graphRoute } from "./routes/graph.js";
import { seedRoute } from "./routes/seed.js";

const app = Fastify({ logger: true });

app.register(chatRoute);
app.register(cleanupRoute);
app.register(graphRoute);
app.register(seedRoute);

await app.listen({
  port: Number(process.env.PORT ?? 4344),
  host: "127.0.0.1",
});
