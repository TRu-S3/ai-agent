import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { repositoryAnalysisAgent } from "./agents";

export const mastra = new Mastra({
    server: {
        port: parseInt(process.env.PORT || "8080", 10), // Use Cloud Run's PORT environment variable
        host: process.env.HOSTNAME || "0.0.0.0", // Bind to all interfaces for Cloud Run
        timeout: 10000, // Defaults to 30000 (30s)
        cors: {
            origin: ["*"], // Allow specific origins or '*' for all
            allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowHeaders: ["Content-Type", "Authorization"],
            credentials: false,
        },
    },
    agents: {
        repositoryAnalysisAgent,
    },
    logger: new PinoLogger({
        name: "Mastra",
        level: "debug",
    }),
});
