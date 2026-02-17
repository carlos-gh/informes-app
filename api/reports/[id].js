import reportsHandler, { config } from "../reports.js";

export { config };

export default async function handler(req, res) {
  return reportsHandler(req, res);
}
