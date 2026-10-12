import React, { memo, useRef, useState, useCallback } from 'react';

const CardCarousel = ({ children, cardWidth = 260 }) => {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollStartRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const childArray = React.Children.toArray(children);
  const gap = 12;
  const itemWidth = cardWidth + gap;

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft } = scrollRef.current;
    const newIndex = Math.round(scrollLeft / itemWidth);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < childArray.length) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex, itemWidth, childArray.length]);

  const handlePointerDown = (e) => {
    if (!scrollRef.current) return;
    isPointerDownRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.clientX;
    scrollStartRef.current = scrollRef.current.scrollLeft;
  };

  const handlePointerMove = (e) => {
    if (!isPointerDownRef.current || !scrollRef.current) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 4) {
      hasDraggedRef.current = true;
      scrollRef.current.scrollLeft = scrollStartRef.current - dx;
    }
  };

  const handlePointerUpOrLeave = () => {
    if (!isPointerDownRef.current || !scrollRef.current) return;
    isPointerDownRef.current = false;
    if (hasDraggedRef.current) {
      const { scrollLeft } = scrollRef.current;
      const targetIndex = Math.max(0, Math.min(childArray.length - 1, Math.round(scrollLeft / itemWidth)));
      scrollRef.current.scrollTo({
        left: targetIndex * itemWidth,
        behavior: 'smooth',
      });
      setActiveIndex(targetIndex);
    }
  };

  return (
    <div className="w-full">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrLeave}
        onPointerLeave={handlePointerUpOrLeave}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory ft-hide-scrollbar py-1 px-0.5 -mx-1 scroll-smooth overscroll-x-contain touch-pan-x cursor-grab active:cursor-grabbing select-none"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {childArray.map((child, index) => (
          <div
            key={index}
            className="shrink-0 snap-center transition-transform duration-200"
            style={{ width: `${cardWidth}px` }}
          >
            {child}
          </div>
        ))}
      </div>

      {childArray.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {childArray.map((_, index) => (
            <button
              type="button"
              key={index}
              onClick={() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTo({
                    left: index * itemWidth,
                    behavior: 'smooth',
                  });
                  setActiveIndex(index);
                }
              }}
              aria-label={`Slide ${index + 1}`}
              className={`rounded-full transition-all duration-300 ease-out cursor-pointer ${
                index === activeIndex
                  ? 'h-1.5 w-4 bg-[var(--accent)] shadow-2xs'
                  : 'h-1.5 w-1.5 bg-[var(--muted)]/30 hover:bg-[var(--muted)]/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(CardCarousel);
