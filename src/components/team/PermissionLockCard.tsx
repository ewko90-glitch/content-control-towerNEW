type PermissionLockCardProps = {
  title: string;
  description: string;
};

export function PermissionLockCard({ title, description }: PermissionLockCardProps) {
  return (
    <section className="rounded-2xl border border-[#FECACA] bg-[#FFF7F7] p-4">
      <p className="text-sm font-semibold text-[#991B1B]">{title}</p>
      <p className="mt-1 text-sm text-[#B91C1C]">{description}</p>
    </section>
  );
}
