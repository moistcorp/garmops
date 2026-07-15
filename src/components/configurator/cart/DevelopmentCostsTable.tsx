import type { DevelopmentCostLine } from './OrderReviewStep';
import { formatInr } from '@/lib/configurator/pricing';

interface DevelopmentCostsTableProps {
  artworkFees: DevelopmentCostLine[];
  applicationFees: DevelopmentCostLine[];
}

export function DevelopmentCostsTable({
  artworkFees,
  applicationFees,
}: DevelopmentCostsTableProps) {
  const rows = [...artworkFees, ...applicationFees];
  const total = rows.reduce((sum, r) => sum + r.unitPrice * r.count, 0);

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-[#111111]/60">
          <th className="py-1.5 font-medium">Label</th>
          <th className="py-1.5 text-right font-medium">Unit Price</th>
          <th className="py-1.5 text-right font-medium">Count</th>
          <th className="py-1.5 pl-3 text-right font-medium">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={`${row.label}-${i}`} className="border-t border-[#E5E5E5]">
            <td className="py-1.5 text-[#111111]">{row.label}</td>
            <td className="py-1.5 text-right text-[#111111]/70">
              {formatInr(row.unitPrice)}
            </td>
            <td className="py-1.5 text-right text-[#111111]/70">{row.count}</td>
            <td className="py-1.5 pl-3 text-right font-medium text-[#111111]">
              {formatInr(row.unitPrice * row.count)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-[#E5E5E5] font-medium">
          <td colSpan={3} className="py-1.5 text-[#111111]">
            Development cost total
          </td>
          <td className="py-1.5 pl-3 text-right text-[#111111]">
            {formatInr(total)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
