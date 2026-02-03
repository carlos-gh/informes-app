export const readJsonBody = async (req) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  try {
    const body = Buffer.concat(chunks).toString("utf-8");
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
};
