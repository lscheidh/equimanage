
import React from 'react';
import { Horse, ComplianceStatus } from '../types';
import { checkVaccinationCompliance, getStatusColor, getStatusLabel } from '../logic';
import { HORSE_PLACEHOLDER_IMAGE } from '../services/horseImageService';

interface HorseCardProps {
  horse: Horse;
  onClick: (horse: Horse) => void;
}

export const HorseCard: React.FC<HorseCardProps> = ({ horse, onClick }) => {
  const compliance = checkVaccinationCompliance(horse);
  const colorClass = getStatusColor(compliance.status);
  const statusLabel = getStatusLabel(compliance.status);

  return (
    <div 
      onClick={() => onClick(horse)}
      className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 group"
    >
      <div className="relative h-44 overflow-hidden">
        <img 
          src={horse.image} 
          alt={horse.name} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={e => { (e.target as HTMLImageElement).src = HORSE_PLACEHOLDER_IMAGE; }}
        />
        <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wider ${colorClass} shadow-md`}>
          {statusLabel}
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-xl font-bold text-slate-800 leading-tight mb-2">{horse.name}</h3>
        
        <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-500 mb-4 bg-slate-50 p-2 rounded-xl">
          <div className="flex justify-between"><span>ISO:</span> <span className="text-slate-700 font-medium">{horse.isoNr}</span></div>
          <div className="flex justify-between"><span>Geb.:</span> <span className="text-slate-700 font-medium">{horse.birthYear}</span></div>
        </div>
        
        <div className="border-t border-slate-100 pt-3 space-y-1">
          {compliance.status === ComplianceStatus.GREEN && compliance.nextDueInfo ? (
            <div className="flex items-start gap-2 text-[10px] text-slate-600">
              <div className={`w-2 h-2 rounded-full ${colorClass} animate-pulse shrink-0 mt-0.5`} />
              <span className="font-semibold uppercase tracking-tighter break-words">{compliance.nextDueInfo.sequence} {compliance.nextDueInfo.type}: Ab {compliance.nextDueInfo.dueDate} fällig, spätestens bis {compliance.nextDueInfo.graceEndDate}</span>
            </div>
          ) : compliance.dueItems.length > 0 ? (
            <ul className="space-y-0.5">
              {compliance.dueItems.map((di, j) => (
                <li key={j} className="flex items-start gap-1.5 text-[10px] text-slate-600">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${getStatusColor(di.status)}`} />
                  <span className="break-words min-w-0">{di.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-start gap-2 text-[10px] text-slate-600">
              <div className={`w-2 h-2 rounded-full ${colorClass} shrink-0 mt-0.5`} />
              <span className="font-semibold uppercase tracking-tighter break-words">{compliance.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
