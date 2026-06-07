const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// GET /api/products — ambil semua produk
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;

    let query = supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    if (category && category !== 'Semua') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products/:id — detail produk
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/products — tambah produk baru
router.post('/', async (req, res) => {
  try {
    const { name, brand, category, wattage, price, stock, min_stock, image_url, description } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Nama produk wajib diisi' });

    const { data, error } = await supabase
      .from('products')
      .insert([{ name, brand, category, wattage, price, stock: stock || 0, min_stock: min_stock || 5, image_url, description }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data, message: 'Produk berhasil ditambahkan' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/products/:id — update produk
router.put('/:id', async (req, res) => {
  try {
    const { name, brand, category, wattage, price, min_stock, image_url, description } = req.body;

    const { data, error } = await supabase
      .from('products')
      .update({ name, brand, category, wattage, price, min_stock, image_url, description })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data, message: 'Produk berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/products/:id — hapus produk
router.delete('/:id', async (req, res) => {
  try {
    // Hapus gambar dari storage jika ada
    const { data: product } = await supabase
      .from('products')
      .select('image_url')
      .eq('id', req.params.id)
      .single();

    if (product?.image_url) {
      const fileName = product.image_url.split('/').pop();
      await supabase.storage.from('products').remove([fileName]);
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
