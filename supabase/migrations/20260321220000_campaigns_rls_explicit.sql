-- Explicit policies replace FOR ALL so INSERT/UPDATE/DELETE behave predictably with PostgREST.
DROP POLICY IF EXISTS "Owners can manage campaigns" ON public.campaigns;

CREATE POLICY "Owners can select own campaigns" ON public.campaigns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert own campaigns" ON public.campaigns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own campaigns" ON public.campaigns
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete own campaigns" ON public.campaigns
  FOR DELETE USING (auth.uid() = user_id);
