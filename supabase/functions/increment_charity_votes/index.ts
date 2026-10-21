
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

serve(async (req) => {
  const { charity_id } = await req.json()
  
  if (!charity_id) {
    return new Response(
      JSON.stringify({ error: 'charity_id is required' }),
      { headers: { 'Content-Type': 'application/json' }, status: 400 }
    )
  }

  try {
    // Create a Supabase client with the Auth context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Increment charity votes
    const { data, error } = await supabaseClient
      .from('charities')
      .update({ votes: supabaseClient.rpc('increment', { row_id: charity_id }) })
      .eq('id', charity_id)
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
