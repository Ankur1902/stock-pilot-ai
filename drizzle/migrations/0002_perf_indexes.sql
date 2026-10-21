CREATE INDEX IF NOT EXISTS idx_products_user_name ON public.products(user_id, name);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON public.products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_name ON public.suppliers(user_id, name);
CREATE INDEX IF NOT EXISTS idx_movements_user_created ON public.stock_movements(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_product ON public.stock_movements(product_id);