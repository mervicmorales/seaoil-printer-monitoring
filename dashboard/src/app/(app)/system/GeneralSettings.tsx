import { Building2, Info, ShieldCheck } from "lucide";
import { Card, IconGlyph } from "@/components/ui";

export default function GeneralSettings() {
  return (
    <Card className="h-full overflow-auto p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
          <IconGlyph icon={Info} size={18} />
        </span>
        <div>
          <h2 className="text-sm font-bold text-[#014171]">About this system</h2>
          <p className="mt-0.5 text-xs text-slate-500">Application purpose and internal-use policy.</p>
        </div>
      </div>
      <div className="mt-5 max-w-3xl overflow-hidden rounded-2xl border border-amber-200 bg-[#FFD15C]/10">
        <div className="flex items-center gap-3 border-b border-amber-200 bg-[#FFD15C]/15 px-4 py-3.5 sm:px-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white text-[#014171] shadow-sm">
            <IconGlyph icon={Building2} size={17} />
          </span>
          <div>
            <p className="font-bold text-[#014171]">SEAOIL Printer Monitoring System</p>
            <p className="mt-0.5 text-xs text-slate-500">Internal operations platform</p>
          </div>
        </div>
        <div className="p-4 text-sm leading-6 text-slate-700 sm:p-5">
          <p>
          This website was made only for SEAOIL Philippines Inc. and is for internal use only.
          It is used to centrally manage the printer fleet, toner inventory, service contracts and
          repair tickets across all SEAOIL offices. Unauthorized use, distribution, or access by
          parties outside of SEAOIL Philippines Inc. is strictly prohibited.
          </p>
          <div className="mt-4 flex items-center gap-2 border-t border-amber-200 pt-4 text-xs font-semibold text-slate-600">
            <IconGlyph icon={ShieldCheck} size={15} />
            Authorized SEAOIL personnel only
          </div>
        </div>
      </div>
    </Card>
  );
}
