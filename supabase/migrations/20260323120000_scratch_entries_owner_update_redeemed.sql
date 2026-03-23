-- Permite ao dono da campanha marcar scratch_entries como resgatadas (redeemed) no caixa.
CREATE POLICY "Campaign owners can update own scratch entries"
  ON public.scratch_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND c.user_id = auth.uid()
    )
  );
