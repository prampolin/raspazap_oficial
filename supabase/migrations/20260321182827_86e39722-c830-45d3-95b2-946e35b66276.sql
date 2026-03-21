
-- Make the insert policy more specific by requiring campaign_id to reference an active campaign
DROP POLICY "Anyone can create entries" ON public.scratch_entries;
CREATE POLICY "Anyone can create entries for active campaigns" ON public.scratch_entries 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.is_active = true)
  );
