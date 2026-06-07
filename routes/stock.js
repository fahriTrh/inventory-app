const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// GET /api/stock — semua transaksi (opsional filter by product_id)
router.get('/', async (req, res) => {
  try {
    const { product_id, limit = 50 } = req.query;

    let query = supabase
      .from('stock_transactions')
      .select(`
        *,
        products (id, name, image_url)
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (product_id) {
      query = query.eq('product_id', product_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/stock — tambah transaksi stok masuk/keluar
router.post('/', async (req, res) => {
  try {
    const { product_id, type, quantity, note } = req.body;

    if (!product_id || !type || !quantity) {
      return res.status(400).json({ success: false, message: 'product_id, type, dan quantity wajib diisi' });
    }
    if (!['in', 'out'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type harus "in" atau "out"' });
    }
    if (quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Jumlah harus lebih dari 0' });
    }

    // Cek stok cukup jika tipe out
    if (type === 'out') {
      const { data: product } = await supabase
        .from('products')
        .select('stock, name')
        .eq('id', product_id)
        .single();

      if (product && product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Stok ${product.name} tidak cukup. Stok tersedia: ${product.stock}`
        });
      }
    }

    const { data, error } = await supabase
      .from('stock_transactions')
      .insert([{ product_id, type, quantity: parseInt(quantity), note }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data, message: `Stok berhasil ${type === 'in' ? 'ditambahkan' : 'dikurangi'}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
