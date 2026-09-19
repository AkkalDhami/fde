import type { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = performance.now();

  res.on("finish", () => {
    const duration = Math.round(performance.now() - start);

    console.log(
      [
        req.method,
        req.originalUrl,
        res.statusCode,
        `${duration}ms`,
        req.ip
      ].join(" ")
    );
  });

  next();
}
