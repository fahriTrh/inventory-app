const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../supabaseClient');

// Multer: simpan file di memory (tidak ke disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Gunakan JPG, PNG, atau WebP'));
    }
  }
});

// POST /api/upload/image — upload gambar produk
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File gambar tidak ditemukan' });
    }

    // Nama file unik pakai timestamp
    const ext = req.file.originalname.split('.').pop();
    const fileName = `product_${Date.now()}.${ext}`;

    // Upload ke Supabase Storage bucket "products"
    const { data, error } = await supabase.storage
      .from('products')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) throw error;

    // Ambil public URL
    const { data: urlData } = supabase.storage
      .from('products')
      .getPublicUrl(fileName);

    res.json({
      success: true,
      url: urlData.publicUrl,
      message: 'Gambar berhasil diupload'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/upload/image — hapus gambar dari storage
router.delete('/image', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL gambar wajib diisi' });

    const fileName = url.split('/').pop();

    const { error } = await supabase.storage
      .from('products')
      .remove([fileName]);

    if (error) throw error;

    res.json({ success: true, message: 'Gambar berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
