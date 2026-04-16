import cors from "cors";
import express from "express";

const app = express();
const port = Number(process.env.PORT) || 3000;

// Local dev: Vite on 5173. Allow any origin for localhost-only tooling.
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());

app.post("/api/ask", (req, res) => {
  const question =
    typeof req.body?.question === "string" ? req.body.question : "";

  if (!question.trim()) {
    res.status(400).json({ error: "Missing or invalid `question`" });
    return;
  }

  res.json({
    message: "ok",
    echo: question,
  });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
