import { supabase } from '../supabaseClient';

export async function nextDeliveryNo() {
  const yy = String(new Date().getFullYear()).slice(-2);
  const { data, error } = await supabase.rpc('next_delivery_no');
  if (error) { console.error('nextDeliveryNo error', error); return 'ERR'; }
  return `${yy}-${String(data).padStart(5,'0')}`;
}
