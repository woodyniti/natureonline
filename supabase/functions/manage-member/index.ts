import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const usernameOk = (v: unknown) => typeof v === 'string' && /^[a-z][a-z0-9_]{2,31}$/.test(v);
const uuidOk = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !service) return reply(500, { error: 'Function configuration missing' });
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return reply(401, { error: 'Login required' });
    const client = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: auth, error: authError } = await client.auth.getUser(token);
    if (authError || !auth.user) return reply(401, { error: 'Invalid session' });
    const admin = createClient(url, service);
    const body = await req.json();
    const { action, shop_id, employee_id, member_id, name, role, username, password } = body;
    if (!uuidOk(shop_id)) return reply(400, { error: 'Invalid shop' });
    const { data: shop, error: shopError } = await admin.from('shops').select('id,owner_id').eq('id', shop_id).single();
    if (shopError || !shop) return reply(404, { error: 'Shop not found' });
    const isOwner = shop.owner_id === auth.user.id;
    const { data: actor } = await admin.from('shop_members').select('role,active,permissions')
      .eq('shop_id', shop_id).eq('user_id', auth.user.id).eq('active', true).maybeSingle();
    const canManage = isOwner || actor?.role === 'admin' || actor?.permissions?.users === true;
    if (!canManage) return reply(403, { error: 'No permission to manage users' });
    if (action === 'permissions' || action === 'deactivate') {
      if (!uuidOk(member_id)) return reply(400, { error: 'Invalid member' });
      const { data: target, error: targetError } = await admin.from('shop_members')
        .select('id,user_id,role,permissions').eq('id', member_id).eq('shop_id', shop_id).single();
      if (targetError || !target) return reply(404, { error: 'Member not found' });
      if (target.role === 'owner' || target.user_id === shop.owner_id || target.user_id === auth.user.id)
        return reply(403, { error: 'Cannot change Owner or your own account' });
      if (!isOwner && target.role === 'admin') return reply(403, { error: 'Only Owner can change Admin' });
      const update: Record<string, unknown> = action === 'deactivate' ? { active: false } : {};
      if (action === 'permissions') {
        const keys = ['dashboard', 'orders', 'quotations', 'monthly', 'expenses', 'finance', 'products',
          'stock', 'employees', 'suppliers', 'purchase', 'apinvoice', 'settings', 'users'];
        if (!body.permissions || typeof body.permissions !== 'object' || Array.isArray(body.permissions))
          return reply(400, { error: 'Invalid permissions' });
        const next: Record<string, boolean> = {};
        for (const key of keys) next[key] = body.permissions[key] === true;
        if (!isOwner && (next.settings || next.users)) return reply(403, { error: 'Owner permission required' });
        update.permissions = next;
      }
      const { error } = await admin.from('shop_members').update(update).eq('id', member_id).eq('shop_id', shop_id);
      return error ? reply(409, { error: error.message }) : reply(200, { ok: true });
    }
    if (typeof name !== 'string' || !name.trim() || name.length > 120) return reply(400, { error: 'Invalid name' });
    if (!['staff', 'admin'].includes(role)) return reply(400, { error: 'Invalid role' });
    if (!isOwner && role === 'admin') return reply(403, { error: 'Only Owner can appoint Admin' });
    if (username && !usernameOk(username)) return reply(400, { error: 'Username must be 3–32 letters, digits or underscores' });
    if (password && (typeof password !== 'string' || password.length < 10)) return reply(400, { error: 'Password must be at least 10 characters' });
    if (employee_id && !uuidOk(employee_id)) return reply(400, { error: 'Invalid employee' });

    let userId: string;
    let created = false;
    let priorEmployeeId: string | null = null;
    if (action === 'create') {
      if (!usernameOk(username) || !password) return reply(400, { error: 'Username and password required' });
      const { data: employee, error: empError } = employee_id
        ? await admin.from('employees').select('id,user_id').eq('id', employee_id).eq('shop_id', shop_id).single()
        : { data: null, error: null };
      if (empError || (employee_id && (!employee || employee.user_id))) return reply(409, { error: 'Employee already linked or not found' });
      const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
        email: `${username}@sealthai.com`, password, email_confirm: true,
        user_metadata: { username, display_name: name.trim() },
      });
      if (createError || !createdUser.user) return reply(409, { error: createError?.message || 'Could not create account' });
      userId = createdUser.user.id;
      created = true;
      const perms = { dashboard: true, orders: true, products: true };
      const { error: memberError } = await admin.from('shop_members').insert({
        shop_id, user_id: userId, name: name.trim(), role, active: true, permissions: perms,
      });
      if (memberError) {
        await admin.auth.admin.deleteUser(userId);
        return reply(409, { error: memberError.message });
      }
    } else if (action === 'update') {
      if (!uuidOk(member_id)) return reply(400, { error: 'Invalid member' });
      const { data: member, error: memberError } = await admin.from('shop_members').select('id,user_id,role')
        .eq('id', member_id).eq('shop_id', shop_id).single();
      if (memberError || !member) return reply(404, { error: 'Member not found' });
      if (member.role === 'owner' || member.user_id === shop.owner_id) return reply(403, { error: 'Owner account cannot be changed here' });
      if (!isOwner && member.role === 'admin') return reply(403, { error: 'Only Owner can edit Admin' });
      userId = member.user_id;
      const { data: oldEmployee } = await admin.from('employees').select('id').eq('shop_id', shop_id).eq('user_id', userId).maybeSingle();
      priorEmployeeId = oldEmployee?.id || null;
      if (employee_id) {
        const { data: selected, error: selectError } = await admin.from('employees').select('id,user_id')
          .eq('id', employee_id).eq('shop_id', shop_id).single();
        if (selectError || (selected.user_id && selected.user_id !== userId)) return reply(409, { error: 'Employee already linked or not found' });
      }
      if (username || password) {
        const updates: Record<string, unknown> = {};
        if (username) updates.email = `${username}@sealthai.com`;
        if (password) updates.password = password;
        if (username) updates.email_confirm = true;
        if (username) updates.user_metadata = { username, display_name: name.trim() };
        const { error } = await admin.auth.admin.updateUserById(userId, updates);
        if (error) return reply(409, { error: error.message });
      }
      const { error } = await admin.from('shop_members').update({ name: name.trim(), role })
        .eq('id', member_id).eq('shop_id', shop_id);
      if (error) return reply(409, { error: error.message });
    } else return reply(400, { error: 'Invalid action' });

    if (employee_id && employee_id !== priorEmployeeId) {
      const { error } = await admin.from('employees').update({ user_id: userId })
        .eq('id', employee_id).eq('shop_id', shop_id).is('user_id', null).select('id').single();
      if (error) {
        if (created) {
          await admin.from('shop_members').delete().eq('shop_id', shop_id).eq('user_id', userId);
          await admin.auth.admin.deleteUser(userId);
        }
        return reply(409, { error: `Link employee failed: ${error.message}` });
      }
      if (priorEmployeeId) await admin.from('employees').update({ user_id: null }).eq('id', priorEmployeeId).eq('shop_id', shop_id);
    } else if (action === 'update' && !employee_id && priorEmployeeId) {
      await admin.from('employees').update({ user_id: null }).eq('id', priorEmployeeId).eq('shop_id', shop_id);
    }
    return reply(200, { user_id: userId });
  } catch (error) {
    console.error('manage-member:', error);
    return reply(500, { error: 'User management failed' });
  }
});
