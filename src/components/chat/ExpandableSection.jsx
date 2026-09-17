import { memo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { triggerHaptic } from '../../lib/haptics';
import PropTypes from 'prop-types';

const ExpandableSection = memo(function ExpandableSection({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleOpen = () => {
    triggerHaptic('light');
    setIsOpen(prev => !prev);
  };

  return (
    <div className={`mt-2 flex flex-col ${isOpen ? 'border-l-2 border-l-[var(--accent)]/40' : ''}`}>
      <div 
        onClick={toggleOpen}
        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl cursor-pointer active:scale-[0.98] transition-transform bg-[var(--field-bg)] border border-[var(--border)]"
      >
        <span className="text-xs font-bold text-[var(--fg)]">{title}</span>
        <ChevronDown 
          size={14} 
          className={`text-[var(--muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </div>
      
      <div 
        className="grid transition-[grid-template-rows] duration-250 ease-out" 
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="pt-2 px-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
});

ExpandableSection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  defaultOpen: PropTypes.bool
};

export default ExpandableSection;
