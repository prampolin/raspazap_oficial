-- Idempotência do aviso ao ganhador (Evolution API): evita reenvio em chamadas repetidas.
ALTER TABLE public.scratch_entries
  ADD COLUMN IF NOT EXISTS whatsapp_notification_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.scratch_entries.whatsapp_notification_sent_at IS
  'Preenchido quando o servidor envia o WhatsApp de aviso ao ganhador.';
