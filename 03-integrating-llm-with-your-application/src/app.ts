import express from "express";
import { requestLogger } from "@/middlewares/request-logger";

type SummarizeService = {
  summarize(ticket: string): Promise<string> | string;
};

export function createApp(summarizeService: SummarizeService) {
  if (!summarizeService?.summarize) {
    throw new TypeError("A summarize service is required");
  }

  const app = express();
  app.use(express.json({ type: "*/*", limit: "100kb" }));
  app.use(requestLogger);

  app.post("/api/summarize", async (request, response) => {
    const ticket =
      typeof request.body.text === "string" ? request.body.text : "";

    if (!ticket.trim()) {
      return response.status(400).json({
        success: false,
        error: "The 'text' field is required in the request body."
      });
    }

    try {
      const summary = await summarizeService.summarize(ticket);
      return response.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error("Failed to summarize ticket:", error);
      return response.status(500).json({
        success: false,
        error: "Unable to summarize the ticket."
      });
    }
  });

  return app;
}
