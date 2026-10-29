import { corsPreflight, json, protectedResourceMetadata } from "@/lib/oauth/metadata";

export function GET() {
  return json(protectedResourceMetadata());
}

export function OPTIONS() {
  return corsPreflight();
}
