import { DigitalTabClient } from "@/components/dineOut/DigitalTabClient";

export default async function ComandaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DigitalTabClient reservationId={id} />;
}
