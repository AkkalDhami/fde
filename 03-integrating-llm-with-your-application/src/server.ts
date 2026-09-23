import "dotenv/config";

import { createApp } from "./app.js";
import { createSummarizeService } from "@/services/summarize.service";

const port = Number(process.env.PORT || 6000);
const app = createApp(createSummarizeService());

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
