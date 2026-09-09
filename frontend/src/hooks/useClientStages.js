import React from "react";
import { supabase } from "../supabase";

// Shared source of truth for the kanban stage list (client_stages table).
// Replaces the old hardcoded STAGES arrays duplicated across several files.
export function useClientStages() {
  const [stages, setStages] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('client_stages').select('*').order('sort_order', { ascending: true });
    setStages(data || []);
    setLoading(false);
  }, []);

  React.useEffect(() => { reload(); }, [reload]);

  return { stages, stageNames: stages.map(s => s.name), loading, reload };
}
