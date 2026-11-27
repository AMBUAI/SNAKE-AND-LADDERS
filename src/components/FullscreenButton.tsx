import React, { useCallback, useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface FullscreenButtonProps {
  showLabel?: boolean;
  className?: string;
}

interface VendorFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface VendorFullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

export const FullscreenButton: React.FC<FullscreenButtonProps> = ({
  showLabel = false,
  className = '',
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const checkFullscreen = useCallback(() => {
    const doc = document as VendorFullscreenDocument;
    return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(checkFullscreen());
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    onChange();
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [checkFullscreen]);

  const toggleFullscreen = async () => {
    const doc = document as VendorFullscreenDocument;
    const root = document.documentElement as VendorFullscreenElement;

    try {
      if (checkFullscreen()) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } else {
        if (root.requestFullscreen) {
          await root.requestFullscreen();
        } else if (root.webkitRequestFullscreen) {
          await root.webkitRequestFullscreen();
        }
      }
    } catch {
      // Ignore if browser or embedded iframe disallows fullscreen
    }
  };

  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
      className={`min-h-[40px] min-w-[40px] rounded-xl bg-[#072619]/90 border border-emerald-200/20 flex items-center justify-center gap-1.5 text-emerald-50 hover:bg-[#0b3524] active:scale-[0.98] transition-all ${
        showLabel ? 'px-3' : 'px-2.5'
      } ${className}`}
    >
      {isFullscreen ? (
        <Minimize2 className="w-4 h-4 text-amber-300 shrink-0" />
      ) : (
        <Maximize2 className="w-4 h-4 text-amber-300 shrink-0" />
      )}
      {showLabel && (
        <span className="text-xs font-bold whitespace-nowrap">
          {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
        </span>
      )}
    </button>
  );
};
