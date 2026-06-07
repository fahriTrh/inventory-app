const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// GET /api/dashboard — ringkasan data untuk halaman utama
router.get('/', async (req, res) => {
  try {
    // Total produk
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    // Produk dengan stok menipis (stok <= min_stock)
    const { data: allProductsForLow } = await supabase
      .from('products')
      .select('id, name, stock, min_stock, image_url, category')
      .order('stock', { ascending: true });

    const lowStock = (allProductsForLow || [])
      .filter(p => p.stock <= p.min_stock)
      .slice(0, 5);

    // Produk dengan stok habis
    const { count: outOfStock } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('stock', 0);

    // Total nilai inventory
    const { data: allProducts } = await supabase
      .from('products')
      .select('price, stock');

    const totalValue = allProducts?.reduce((sum, p) => sum + (p.price * p.stock), 0) || 0;

    // Transaksi terbaru (5 terakhir)
    const { data: recentTransactions } = await supabase
      .from('stock_transactions')
      .select(`*, products (name, image_url)`)
      .order('created_at', { ascending: false })
      .limit(5);

    // Distribusi per kategori
    const { data: categoryData } = await supabase
      .from('products')
      .select('category, stock');

    const categoryStats = categoryData?.reduce((acc, p) => {
      const cat = p.category || 'Lainnya';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalProducts: totalProducts || 0,
        outOfStock: outOfStock || 0,
        lowStockCount: lowStock?.length || 0,
        totalValue,
        lowStock: lowStock || [],
        recentTransactions: recentTransactions || [],
        categoryStats: categoryStats || {}
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
