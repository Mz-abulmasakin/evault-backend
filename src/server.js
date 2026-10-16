import env from "./config/env.js";
import app from "./app.js";
import { connectDatabase } from "./database/connection.js";

async function startServer() {
  console.log("🚀 Starting Evault Backend...");

  await connectDatabase();

  app.listen(env.server.port, '0.0.0.0', 
    () => {
    console.log(`🌐 Server running on port ${env.server.port}`);
  });
}

startServer();