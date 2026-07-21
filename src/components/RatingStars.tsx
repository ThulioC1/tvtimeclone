interface Props {
  value: number;
  onChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
  count?: number;
}

const sizeMap = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' };

const RatingStars = ({ value, onChange, size = 'md', count }: Props) => {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-1">
      <div className={`flex ${sizeMap[size]} gap-0.5`}>
        {stars.map((star) => {
          const filled = star <= Math.round(value);
          return onChange ? (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className={`transition-colors ${
                filled ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400/50'
              }`}
            >
              {filled ? '★' : '☆'}
            </button>
          ) : (
            <span
              key={star}
              className={filled ? 'text-yellow-400' : 'text-gray-600'}
            >
              {filled ? '★' : '☆'}
            </span>
          );
        })}
      </div>
      {value > 0 && (
        <span className="text-xs text-gray-400 ml-1">
          {value.toFixed(1)}
          {count !== undefined && ` (${count})`}
        </span>
      )}
    </div>
  );
};

export default RatingStars;
