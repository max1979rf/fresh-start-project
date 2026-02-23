-- Insert admin user: contato@maxx.ia.br / admin123
INSERT INTO public.usuarios (id, nome, login, senha_hash, id_setor, role, status, criado_em)
VALUES (
  'u_admin_maxx',
  'Administrador Maxx',
  'contato@maxx.ia.br',
  'h_g10hvh',
  NULL,
  'admin',
  'ativo',
  now()
)
ON CONFLICT (login) DO NOTHING;
