const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !data) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }

    req.session.loggedIn = true;
    req.session.username = data.username;
    req.session.adminId = data.id;

    res.json({ success: true, message: 'Login berhasil' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (req.session?.loggedIn) {
    return res.json({ success: true, username: req.session.username });
  }
  res.status(401).json({ success: false });
});

// POST /api/auth/change — ganti username & password
router.post('/change', async (req, res) => {
  if (!req.session?.loggedIn) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { newUsername, newPassword, currentPassword } = req.body;

  if (!currentPassword) {
    return res.status(400).json({ success: false, message: 'Password saat ini wajib diisi' });
  }

  try {
    // Verifikasi password lama
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', req.session.adminId)
      .eq('password', currentPassword)
      .single();

    if (error || !admin) {
      return res.status(400).json({ success: false, message: 'Password saat ini salah' });
    }

    // Siapkan data update
    const updates = {};
    if (newUsername) updates.username = newUsername;
    if (newPassword) updates.password = newPassword;

    const { error: updateError } = await supabase
      .from('admin_users')
      .update(updates)
      .eq('id', req.session.adminId);

    if (updateError) throw updateError;

    // Update session
    if (newUsername) req.session.username = newUsername;

    res.json({ success: true, message: 'Kredensial berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;