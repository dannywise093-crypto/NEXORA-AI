import { forward } from "./_gateway.js";
export default function handler(req, res) { return forward(req, res, "/api/providers", "GET"); }
