export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <h1 className="text-2xl font-semibold">تصنيف: {slug}</h1>;
}
