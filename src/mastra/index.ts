import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { repositoryAnalysisAgent } from "./agents";

export const mastra = new Mastra({
    server: {
        port: 4111, // Defaults to 4111
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

