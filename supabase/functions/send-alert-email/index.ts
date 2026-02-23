const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { to, subject, contractNumber, company, expiryDate, sectorName, message } = await req.json();

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: 'Campos "to" e "subject" são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">⚠️ Alerta de Contrato</h1>
        </div>
        <div style="padding: 32px;">
          <p style="color: #333; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
            ${message || 'Um contrato requer sua atenção.'}
          </p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 12px 16px; background: #e8ecf1; border-radius: 8px 8px 0 0; font-weight: 600; color: #555; font-size: 13px;">Contrato</td>
              <td style="padding: 12px 16px; background: #e8ecf1; border-radius: 8px 8px 0 0; color: #333; font-size: 14px;">${contractNumber || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; background: #f0f2f5; font-weight: 600; color: #555; font-size: 13px;">Empresa</td>
              <td style="padding: 12px 16px; background: #f0f2f5; color: #333; font-size: 14px;">${company || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; background: #e8ecf1; font-weight: 600; color: #555; font-size: 13px;">Vencimento</td>
              <td style="padding: 12px 16px; background: #e8ecf1; color: #dc3545; font-weight: 600; font-size: 14px;">${expiryDate || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; background: #f0f2f5; border-radius: 0 0 8px 8px; font-weight: 600; color: #555; font-size: 13px;">Setor</td>
              <td style="padding: 12px 16px; background: #f0f2f5; border-radius: 0 0 8px 8px; color: #333; font-size: 14px;">${sectorName || 'N/A'}</td>
            </tr>
          </table>
          <p style="color: #888; font-size: 12px; text-align: center; margin: 0;">
            Este é um alerta automático do sistema de gestão de contratos.
          </p>
        </div>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Alertas <onboarding@resend.dev>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html: htmlContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: 'Falha ao enviar email', details: data }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
