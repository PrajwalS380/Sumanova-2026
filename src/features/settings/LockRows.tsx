import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { biometricAvailable, enableBiometric, lockConfig, removeLock, setPin, updateLock, type LockAfter } from '@/lib/appLock';
import { screenProtection } from '@/lib/privacy';
import { Toggle } from '@/components/ui/Toggle';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { PinPad } from '@/components/AppLockGate';
import { useToast } from '@/providers/ToastProvider';

/** PIN set-up in two steps (enter, confirm). Resolves with the PIN or null when cancelled. */
export function PinSetupSheet({ open, onClose, onSet }: { open: boolean; onClose: () => void; onSet: () => void }) {
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) {
      setFirst(null);
      setError('');
    }
  }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title="App lock PIN">
      <div className="pb-6 pt-2">
        <PinPad
          key={first ? 'confirm' : 'new'}
          title={first ? 'Type it again' : 'Choose a PIN'}
          sub={first ? undefined : '4 to 6 digits. It stays on this phone.'}
          error={error}
          onDone={async (pin) => {
            if (!first) {
              setFirst(pin);
              setError('');
              return;
            }
            if (pin !== first) {
              setFirst(null);
              setError('PINs didn’t match — start again');
              return;
            }
            await setPin(pin);
            onSet();
          }}
        />
      </div>
    </Sheet>
  );
}

/** Settings → Privacy: app lock, fingerprint, lock timing, block screenshots. */
export function LockRows() {
  const toast = useToast();
  const [cfg, setCfg] = useState(lockConfig);
  const tr = useT();
  const [setup, setSetup] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const [secure, setSecure] = useState(() => screenProtection.always);
  useEffect(() => {
    void biometricAvailable().then(setBioOk);
  }, []);
  const refresh = () => setCfg(lockConfig());

  return (
    <>
      <Toggle
        label={tr('App lock')}
        description="Ask for a PIN when SUMANOVA opens"
        checked={!!cfg}
        onChange={(v) => {
          if (v) setSetup(true);
          else if (window.confirm('Turn off app lock? Hidden chats will show in your chat list again.')) {
            removeLock();
            refresh();
          }
        }}
      />
      {cfg && (
        <>
          <Segmented<string>
            label="Lock again after"
            value={String(cfg.after)}
            options={[
              { value: '0', label: 'Right away' },
              { value: '60', label: '1 min' },
              { value: '300', label: '5 min' },
              { value: '900', label: '15 min' },
            ]}
            onChange={(v) => {
              updateLock({ after: Number(v) as LockAfter });
              refresh();
            }}
          />
          {bioOk && (
            <Toggle
              label="Unlock with fingerprint or face"
              checked={cfg.bio}
              onChange={async (v) => {
                if (v) {
                  if (!(await enableBiometric())) toast('Couldn’t turn on fingerprint unlock', 'error');
                } else updateLock({ bio: false, cred: undefined });
                refresh();
              }}
            />
          )}
          <button type="button" onClick={() => setSetup(true)} className="w-full px-3.5 py-[13px] text-left text-[15px] font-semibold">Change PIN</button>
        </>
      )}
      {screenProtection.supported && (
        <Toggle
          label="Block screenshots"
          description="No screenshots or screen recording anywhere in the app, and the preview in Recents is hidden"
          checked={secure}
          onChange={(v) => {
            setSecure(v);
            void screenProtection.setAlways(v);
          }}
        />
      )}
      <PinSetupSheet
        open={setup}
        onClose={() => setSetup(false)}
        onSet={() => {
          setSetup(false);
          refresh();
          toast(cfg ? 'PIN changed' : 'App lock is on', 'success');
        }}
      />
    </>
  );
}
