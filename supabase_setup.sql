-- ============================================
-- INVENTORY LAMPU - SUPABASE SETUP
-- Jalankan file ini di Supabase SQL Editor
-- ============================================

-- 1. Tabel produk
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT CHECK (category IN ('LED', 'Neon', 'Halogen', 'Pijar', 'Solar', 'Lainnya')),
  wattage NUMERIC,
  price NUMERIC DEFAULT 0,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 5,
  image_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel transaksi stok
CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('in', 'out')) NOT NULL,
  quantity INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Auto-update kolom updated_at saat produk diedit
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Auto-update stok produk saat ada transaksi baru
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'in' THEN
    UPDATE products SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.type = 'out' THEN
    UPDATE products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock
  AFTER INSERT ON stock_transactions
  FOR EACH ROW EXECUTE FUNCTION update_product_stock();

-- 5. Enable Row Level Security (nonaktifkan dulu untuk development)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: izinkan semua operasi (untuk development tanpa auth)
CREATE POLICY "allow_all_products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transactions" ON stock_transactions FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- STORAGE BUCKET SETUP
-- Jalankan juga di SQL Editor
-- ============================================

-- Buat bucket untuk gambar produk
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Policy storage: izinkan upload & baca
CREATE POLICY "allow_upload_products" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'products');

CREATE POLICY "allow_read_products" ON storage.objects
  FOR SELECT USING (bucket_id = 'products');

CREATE POLICY "allow_delete_products" ON storage.objects
  FOR DELETE USING (bucket_id = 'products');
