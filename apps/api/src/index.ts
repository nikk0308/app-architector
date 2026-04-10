import { createApp } from "./app.js";
import { env } from "./env.js";

const app = createApp();

app.listen({ port: env.PORT, host: env.HOST })
  .then(() => {
    app.log.info(`API listening on ${env.HOST}:${env.PORT}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
