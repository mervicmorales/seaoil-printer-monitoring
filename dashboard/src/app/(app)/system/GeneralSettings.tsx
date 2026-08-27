import { Card } from "@/components/ui";

export default function GeneralSettings() {
  return (
    <Card className="h-full overflow-auto p-6">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">About</h3>
      <div className="mt-4 rounded-lg bg-[#FFD15C]/15 p-4 text-sm text-slate-700">
        <p className="font-semibold text-[#014171]">SEAOIL Printer Monitoring System</p>
        <p className="mt-2">
          This website was made only for SEAOIL Philippines Inc. and is for internal use only.
          It is used to centrally manage the printer fleet, toner inventory, service contracts and
          repair tickets across all SEAOIL locations. Unauthorized use, distribution, or access by
          parties outside of SEAOIL Philippines Inc. is strictly prohibited.
        </p>
      </div>
    </Card>
  );
}
