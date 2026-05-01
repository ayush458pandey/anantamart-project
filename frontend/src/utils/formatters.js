export const formatCaseSize = (caseSize, unitLabel) => {
    if (!caseSize) return '';
    const safeUnit = String(unitLabel || '').trim();
    
    // Check if unitLabel starts with a number like "12 pcs" or "50 pcs"
    const match = safeUnit.match(/^(\d+)\s*(.*)$/);
    if (match) {
        const qtyInPack = parseInt(match[1], 10);
        const baseUnit = match[2].trim() || 'pcs';
        
        if (qtyInPack > 1) {
            // e.g. caseSize: 40, unitLabel: "12 pcs" -> "40 packs (480 pcs)"
            return `${caseSize} pack${caseSize > 1 ? 's' : ''} (${caseSize * qtyInPack} ${baseUnit})`;
        } else {
            // e.g. caseSize: 40, unitLabel: "1 pack" -> "40 packs"
            return `${caseSize} ${baseUnit || 'pack'}${caseSize > 1 && !baseUnit.endsWith('s') ? 's' : ''}`;
        }
    }
    
    if (safeUnit) {
        const lowerUnit = safeUnit.toLowerCase();
        if (['pack', 'packs', 'pcs', 'pieces', 'unit', 'units'].includes(lowerUnit)) {
             return `${caseSize} ${safeUnit}`;
        }
        return `${caseSize} pack${caseSize > 1 ? 's' : ''}`;
    }
    
    return `${caseSize} units`;
};
