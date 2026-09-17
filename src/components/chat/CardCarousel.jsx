import React, { memo, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

const CardCarousel = ({ children, cardWidth = 260 }) => {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const childArray = React.Children.toArray(children);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollLeft } = scrollRef.current;
    // gap is 12px (gap-3)
    const gap = 12;
    const itemWidth = cardWidth + gap;

    const newIndex = Math.round(scrollLeft / itemWidth);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < childArray.length) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex, cardWidth, childArray.length]);

  return (
    <div className="w-full">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory ft-hide-scrollbar py-1 px-0.5 -mx-1"
      >
        {childArray.map((child, index) => (
          <div
            key={index}
            className="shrink-0 snap-center"
            style={{ width: `${cardWidth}px` }}
          >
            {child}
          </div>
        ))}
      </div>

      {childArray.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {childArray.map((_, index) => (
            <div
              key={index}
              className={`rounded-full transition-all duration-200 ${
                index === activeIndex
                  ? 'h-1.5 w-4 bg-[var(--accent)]'
                  : 'h-1.5 w-1.5 bg-[var(--muted)]/30'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

CardCarousel.propTypes = {
  children: PropTypes.node,
  cardWidth: PropTypes.number,
};

export default memo(CardCarousel);
