const MAX_JSON_BODY_BYTES = 1024 * 1024;

export const readJsonBody = async (req) => {
  try {
    if (req.body) {
      if (typeof req.body === "string") {
        if (Buffer.byteLength(req.body, "utf-8") > MAX_JSON_BODY_BYTES) {
          return null;
        }

        return JSON.parse(req.body);
      }

      if (typeof req.body === "object") {
        return req.body;
      }
    }

    const chunks = [];
    let totalBytes = 0;

    for await (const chunk of req) {
      chunks.push(chunk);
      totalBytes += chunk.length;

      if (totalBytes > MAX_JSON_BODY_BYTES) {
        return null;
      }
    }

    if (chunks.length === 0) {
      return null;
    }

    const body = Buffer.concat(chunks).toString("utf-8");
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
};
