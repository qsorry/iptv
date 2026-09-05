export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <h1 className="text-2xl font-semibold">منتج: {slug}</h1>;
}
