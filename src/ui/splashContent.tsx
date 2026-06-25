import type { ReactNode } from 'react';
import type { SplashPage } from '../persistence/splash.ts';

// Single source of truth for onboarding copy. Text is the approved final copy from
// docs/superpowers/specs/2026-06-25-onboarding-splashpages-design.md — verbatim.
// Inline <strong> marks the terms the spec emphasises; the italic aside on Map is
// the "On this page" wayfinding line.

interface SplashContent {
  title: string;
  body: ReactNode;
}

export const SPLASH_CONTENT: Record<SplashPage, SplashContent> = {
  map: {
    title: 'Welcome to Polis',
    body: (
      <>
        <p>
          Polis is a visualization of your life, imagined as a city. Tend your daily habits and it
          thrives and grows; neglect them and it slowly weathers and crumbles. The city is divided
          into <strong>districts</strong> — the key areas of your life (we suggest Work, Family,
          Friends, Faith, and Health). Each district holds <strong>boroughs</strong> (you might split
          Health into Mind, Body, and Soul). Habits attach to these. For a specific goal, raise a{' '}
          <strong>landmark</strong> (under Health › Mind, perhaps “Memorize my favorite poem”). To
          begin, open <strong>Profile</strong>, add your details, and design your city.
        </p>
        <p className="splash-aside">
          <em>On this page:</em> hover a district to find it; click a district in the rail — or a
          borough on the map — to see its health and connected habits. Press{' '}
          <strong>Log today</strong> to record your day.
        </p>
      </>
    ),
  },
  life: {
    title: 'Your life in weeks',
    body: (
      <p>
        Every box is one week of your life. Soft bands mark your life eras, and once you start
        checking in, each lived week tints by how your city fared — thriving green to weathered rust.
        Birthdays are ringed; milestones you add in Profile show up here. It’s the long view: the
        shape of how you’ve been living, all at once.
      </p>
    ),
  },
  history: {
    title: 'Walk back through your city',
    body: (
      <p>
        Every day you check in — or that simply passes — is saved as a snapshot. Step through them to
        see how your city stood on any recorded day, and whether it thrived or slipped. This view is
        read-only; nothing here changes your city.
      </p>
    ),
  },
  profile: {
    title: 'Design your city',
    body: (
      <p>
        Profile is where you build your city and set who it belongs to. Add your name and date of
        birth (this frames the Life page), then shape the place: create <strong>districts</strong>{' '}
        for the major areas of your life, divide them into <strong>boroughs</strong>, and attach{' '}
        <strong>habits</strong> (good or bad, each weighted). Raise a <strong>landmark</strong> for a
        specific goal, and add <strong>milestones</strong> to mark big dates on your Life grid. This
        is your blueprint — start here.
      </p>
    ),
  },
};
