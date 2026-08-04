import EstimateSubNav from "@/components/EstimateSubNav";

export default function WindowEstimateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <EstimateSubNav />
      {children}
    </div>
  );
}
