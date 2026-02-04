export const readJsonBody = async (req) => {
  try {
    if (req.body) {
      if (typeof req.body === "string") {
        return JSON.parse(req.body);
      }

      if (typeof req.body === "object") {
        return req.body;
      }
    }

    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
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
