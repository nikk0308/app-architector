import { createApp } from "./app.js";
import { env } from "./env.js";

const app = createApp();

const start = async (): Promise<void> => {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`API listening on http://${env.HOST}:${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
