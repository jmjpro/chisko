interface WizardStepProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export default function WizardStep({
  title,
  description,
  children,
}: WizardStepProps) {
  return (
    <>
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      {description && (
        <p className="text-muted-foreground mb-4">{description}</p>
      )}
      {children}
    </>
  );
}
