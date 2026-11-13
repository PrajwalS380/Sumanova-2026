import { Map } from 'lucide-react';
import { ComingSoon } from './ComingSoon';

export const MapScreen = () => (
  <ComingSoon title="Map" icon={Map} headline="See friends nearby" phase="Phase 8" points={['Opt-in location sharing only', 'Ghost mode is on by default', 'Share with selected friends for a set time', 'Sharing stops automatically when time is up']} />
);
