import { authorizationServerMetadata, corsPreflight, json } from "@/lib/oauth/metadata";

export function GET() {
  return json(authorizationServerMetadata());
}

export function OPTIONS() {
  return corsPreflight();
}
