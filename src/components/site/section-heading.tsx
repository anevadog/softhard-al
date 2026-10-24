type SectionHeadingProps = {
  as?: "h1" | "h2";
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({
  as = "h2",
  id,
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeadingProps) {
  const alignment = align === "center" ? "items-center text-center" : "items-start text-left";
  const Heading = as;

  return (
    <div className={`flex flex-col ${alignment} ${className ?? ""}`}>
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {eyebrow}
      </span>
      <Heading
        id={id}
        className="mt-4 text-balance text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
      >
        {title}
      </Heading>
      {description ? (
        <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-slate-600">
          {description}
        </p>
      ) : null}
    </div>
  );
}
