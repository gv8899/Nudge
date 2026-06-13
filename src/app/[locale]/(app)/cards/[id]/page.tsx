import { CardsSplit } from "@/components/cards/cards-split";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CardsSplit initialCardId={id} />;
}
