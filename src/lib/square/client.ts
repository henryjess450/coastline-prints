import "server-only";
import { SquareClient, SquareEnvironment } from "square";

/** Public values the browser needs to render the card form. */
export type SquarePublicConfig = {
  applicationId: string;
  locationId: string;
  environment: "sandbox" | "production";
  scriptUrl: string;
};

export function squareEnvironment(): "sandbox" | "production" {
  return process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
}

export function squarePublicConfig(): SquarePublicConfig | null {
  const applicationId = process.env.SQUARE_APPLICATION_ID;
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!applicationId || !locationId || !process.env.SQUARE_ACCESS_TOKEN) return null;
  const environment = squareEnvironment();
  return {
    applicationId,
    locationId,
    environment,
    scriptUrl: environment === "production" ? "https://web.squarecdn.com/v1/square.js" : "https://sandbox.web.squarecdn.com/v1/square.js",
  };
}

let client: SquareClient | null = null;

export function getSquare(): SquareClient {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN is not set");
  client ??= new SquareClient({
    token,
    environment: squareEnvironment() === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });
  return client;
}

export function squareLocationId() {
  const id = process.env.SQUARE_LOCATION_ID;
  if (!id) throw new Error("SQUARE_LOCATION_ID is not set");
  return id;
}
