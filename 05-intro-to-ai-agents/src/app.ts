import express from "express";
import { requestLogger } from "@/middlewares/request-logger";

type AiAgentService = {
  summarize(ticket: string): Promise<string> | string;
};

export function createApp(aiAgentService: AiAgentService) {
  if (!aiAgentService?.summarize) {
    throw new TypeError("An AI agent service is required");
  }

  const app = express();
  app.use(express.json({ type: "*/*", limit: "100kb" }));
  app.use(requestLogger);

  app.post("/api/agent", async (request, response) => {
    const ticket =
      typeof request.body.prompt === "string" ? request.body.prompt : "";

    if (!ticket.trim()) {
      return response.status(400).json({
        success: false,
        error: "The 'prompt' field is required in the request body."
      });
    }

    try {
      const summary = await aiAgentService.summarize(ticket);
      return response.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error("Internal error:", error);
      return response.status(500).json({
        success: false,
        error: "An internal error occurred while processing the request."
      });
    }
  });

  return app;
}
