export function Icon({
  children
}: {
  children: string;
}) {
  return (
    <span aria-hidden="true">
      {children}
    </span>
  );
}