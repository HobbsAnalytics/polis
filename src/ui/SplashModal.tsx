import { useState } from 'react';
import { Modal } from './Modal.tsx';
import { SPLASH_CONTENT } from './splashContent.tsx';
import type { SplashPage } from '../persistence/splash.ts';

interface Props {
  page: SplashPage;
  /** Close the splash. Always marks the page seen (Got it / Esc / scrim / ✕). */
  onClose: () => void;
  /** Tick "Don't show this again" — an explicit early opt-out that marks seen now. */
  onDontShowAgain: () => void;
}

/**
 * Per-page onboarding splash. Wraps the accessible `Modal` (focus-trap / Esc /
 * scrim / focus-restore / reduced-motion) and adds the page's copy plus a footer:
 * a "Don't show this again" control and a primary "Got it" button. Both dismissing
 * and ticking mark the page seen — there is no shown-but-not-seen state.
 */
export function SplashModal({ page, onClose, onDontShowAgain }: Props) {
  const { title, body } = SPLASH_CONTENT[page];
  const [dontShow, setDontShow] = useState(false);

  return (
    <Modal title={title} onClose={onClose}>
      <div className="splash-body">{body}</div>
      <div className="splash-foot">
        <label className="splash-dontshow">
          <input
            type="checkbox"
            checked={dontShow}
            onChange={(e) => {
              setDontShow(e.target.checked);
              if (e.target.checked) onDontShowAgain();
            }}
          />
          Don’t show this again
        </label>
        <button type="button" className="btn-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </Modal>
  );
}
