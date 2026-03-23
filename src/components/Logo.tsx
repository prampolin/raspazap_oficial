import { Zap } from "lucide-react";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
        <Zap className="w-6 h-6 text-white" />
      </div>
      <span className="text-xl font-bold text-gray-900">RaspaZap</span>
    </div>
  );
}
