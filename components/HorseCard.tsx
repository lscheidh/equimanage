
import React from 'react';
import { Horse } from '../types';
import { checkVaccinationCompliance, getStatusColor, getStatusLabel } from '../logic';

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
        
        <div className="flex items-center gap-2 text-[10px] text-slate-600 border-t border-slate-100 pt-3">
          <div className={`w-2 h-2 rounded-full ${colorClass} animate-pulse`} />
          <span className="font-semibold truncate uppercase tracking-tighter">{compliance.message}</span>
        </div>
      </div>
    </div>
  );
};
