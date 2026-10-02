CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own suppliers" ON public.suppliers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  sku text NOT NULL,
  category text,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  cost_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  selling_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  current_stock integer NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_stock integer NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, sku)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own products" ON public.products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('in','out')),
  quantity integer NOT NULL CHECK (quantity > 0),
  movement_date date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own movements" ON public.stock_movements FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_stock_movement(_product_id uuid, _type text, _quantity integer, _date date, _note text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_stock integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _type NOT IN ('in','out') THEN RAISE EXCEPTION 'Invalid movement type'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero'; END IF;
  UPDATE public.products
    SET current_stock = current_stock + CASE WHEN _type = 'in' THEN _quantity ELSE -_quantity END
    WHERE id = _product_id AND user_id = auth.uid()
      AND (_type = 'in' OR current_stock >= _quantity)
    RETURNING current_stock INTO new_stock;
  IF new_stock IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = _product_id AND user_id = auth.uid()) THEN
      RAISE EXCEPTION 'Product not found';
    END IF;
    RAISE EXCEPTION 'Not enough stock: this would make stock negative';
  END IF;
  INSERT INTO public.stock_movements (user_id, product_id, type, quantity, movement_date, note)
    VALUES (auth.uid(), _product_id, _type, _quantity, COALESCE(_date, current_date), NULLIF(_note,''));
  RETURN new_stock;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_stock_movement(uuid,text,integer,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(uuid,text,integer,date,text) TO authenticated;