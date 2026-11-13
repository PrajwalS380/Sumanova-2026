import { Clapperboard, Images, Map, Sparkles } from 'lucide-react';
import { ComingSoon } from './ComingSoon';

export const StoriesScreen = () => (
  <ComingSoon title="Stories" icon={Sparkles} headline="24-hour stories" phase="Phase 6" points={['Photo, video and text stories', 'Friends-only, public or custom audiences', 'Viewer lists and replies', 'Highlights that never expire']} />
);
export const MapScreen = () => (
  <ComingSoon title="Map" icon={Map} headline="See friends nearby" phase="Phase 8" points={['Opt-in location sharing only', 'Ghost mode is on by default', 'Share with selected friends for a set time', 'Sharing stops automatically when time is up']} />
);
export const SpotlightScreen = () => (
  <ComingSoon title="Spotlight" icon={Clapperboard} headline="Short-video feed" phase="Phase 7" points={['Full-screen vertical videos', 'Like, comment, save and share', 'Follow creators', 'Trending categories']} />
);
export const MemoriesScreen = () => (
  <ComingSoon title="Memories" icon={Images} headline="Your private library" phase="Phase 7" points={['Save snaps and stories privately', 'Albums and favourites', 'Search by date', 'Turn memories into stories']} />
);
