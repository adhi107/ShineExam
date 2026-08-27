/**
 * ScreenVisibilityGuard
 * ──────────────────────
 * A lightweight component that blurs/hides the wrapped content when the
 * browser tab loses focus or the page becomes hidden (visibilitychange).
 *
 * Use this on pages that need tab-hide protection but do NOT need the full
 * SensitiveContent suite (no watermark, no copy protection needed).
 *
 * Example usage:
 *   <ScreenVisibilityGuard>
 *     <SomeModeratelySensitivePage />
 *   </ScreenVisibilityGuard>
 */

import React, { useEffect, useState } from 'react';
import './security.css';

interface ScreenVisibilityGuardProps {
  children: React.ReactNode;
  /** 'blur' shows blurred content; 'hide' replaces with message (default: 'blur') */
  mode?: 'blur' | 'hide';
  /** Custom message shown in 'hide' mode */
  message?: string;
  /** Extra className for the wrapper */
  className?: string;
}

const ScreenVisibilityGuard: React.FC<ScreenVisibilityGuardProps> = ({
  children,
  mode = 'blur',
  message = 'Content hidden. Return to this tab to view.',
  className = '',
}) => {
  const [isHidden, setIsHidden] = useState<boolean>(
    typeof document !== 'undefined' ? document.hidden : false
  );

  useEffect(() => {
    const onVisibilityChange = () => setIsHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const wrapperClass = [
    'shine-visibility-guard',
    isHidden && mode === 'blur' ? 'shine-visibility-guard--blurred' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClass}>
      {mode === 'hide' && isHidden ? (
        <div className="shine-visibility-guard__overlay" role="alert">
          <p>{message}</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
};

export default ScreenVisibilityGuard;
