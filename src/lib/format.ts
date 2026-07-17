const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

export const formatWatchTime = (totalMinutes: number): string => {
  if (!totalMinutes || totalMinutes <= 0) return '0min';

  const totalHours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;

  if (totalHours < 24) {
    if (totalHours === 0) return `${minutes}min`;
    return minutes > 0 ? `${totalHours}h ${minutes}min` : `${totalHours}h`;
  }

  const totalDays = Math.floor(totalHours / HOURS_PER_DAY);
  const hours = totalHours % HOURS_PER_DAY;

  if (totalDays < DAYS_PER_MONTH) {
    if (hours === 0) return `${totalDays} ${totalDays === 1 ? 'dia' : 'dias'}`;
    return `${totalDays}d ${hours}h`;
  }

  const totalMonths = Math.floor(totalDays / DAYS_PER_MONTH);
  const days = totalDays % DAYS_PER_MONTH;

  if (totalDays < DAYS_PER_YEAR) {
    if (days === 0) return `${totalMonths} ${totalMonths === 1 ? 'mês' : 'meses'}`;
    return `${totalMonths}m ${days}d`;
  }

  const totalYears = Math.floor(totalDays / DAYS_PER_YEAR);
  const remainingMonths = Math.floor((totalDays % DAYS_PER_YEAR) / DAYS_PER_MONTH);

  if (remainingMonths === 0) return `${totalYears} ${totalYears === 1 ? 'ano' : 'anos'}`;
  return `${totalYears}a ${remainingMonths}m`;
};
