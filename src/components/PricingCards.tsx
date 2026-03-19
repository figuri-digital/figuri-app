export default function PricingCards() {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="rounded-lg border p-6 text-center">
        <h3 className="font-bold">Básico</h3>
      </div>
      <div className="rounded-lg border p-6 text-center">
        <h3 className="font-bold">Pro</h3>
      </div>
      <div className="rounded-lg border p-6 text-center">
        <h3 className="font-bold">Premium</h3>
      </div>
    </section>
  );
}
