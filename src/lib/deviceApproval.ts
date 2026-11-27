import { supabase } from './supabase';
import { deviceKey, deviceLabel } from './security';

export type DeviceStatus = 'approved' | 'pending' | 'denied';
export interface DeviceRequest { id: string; device: string; created_at: string }

/** New-device approval (Settings → Security). The database enforces it; these are the app's calls. */
export const deviceApproval = {
  async check(): Promise<DeviceStatus> {
    const { data, error } = await supabase.rpc('device_check', { p_device_key: deviceKey(), p_device: deviceLabel() });
    if (error) throw new Error(error.message);
    return data === 'pending' || data === 'denied' ? data : 'approved';
  },
  async enabled(uid: string): Promise<boolean> {
    const { data } = await supabase.from('device_trust').select('enabled').eq('user_id', uid).maybeSingle();
    return !!data?.enabled;
  },
  async set(on: boolean) {
    const { error } = await supabase.rpc('set_device_approval', { p_on: on, p_device_key: deviceKey(), p_device: deviceLabel() });
    if (error) throw new Error(error.message);
  },
  async requests(): Promise<DeviceRequest[]> {
    const { data, error } = await supabase.rpc('device_requests');
    if (error) throw new Error(error.message);
    return (data ?? []) as DeviceRequest[];
  },
  async decide(id: string, approve: boolean) {
    const { error } = await supabase.rpc('device_decide', { p_id: id, p_approve: approve });
    if (error) throw new Error(error.message);
  },
};
