ALTER TABLE public.sales_machine_connected_mailboxes DROP CONSTRAINT IF EXISTS sales_machine_connected_mailboxes_provider_check;
ALTER TABLE public.sales_machine_connected_mailboxes ADD CONSTRAINT sales_machine_connected_mailboxes_provider_check CHECK (provider IN ('gmail', 'smtp'));
