-- Seed 100% sintético — Santos (bairros reais, estabelecimentos fictícios).
-- Cenários: vaga ok, sem vaga, preço alto (incompatível com faixa 1).

truncate table
  public.app_events,
  public.return_invites,
  public.saved_preferences,
  public.reservations,
  public.recommendation_items,
  public.recommendations,
  public.discovery_requests,
  public.restaurant_slots,
  public.restaurant_hours,
  public.restaurants
restart identity cascade;

-- IDs fixos para demos e testes
insert into public.restaurants (
  id, name, description, neighborhood, address, price_range, occasion_tags, is_active, is_synthetic
) values
-- Gonzaga
('11111111-1111-1111-1111-111111111101', 'Casa do Farol', 'Frutos do mar leves para jantar a dois.', 'Gonzaga', 'Rua Sintética 101, Gonzaga', 3, array['jantar_a_dois','especial'], true, true),
('11111111-1111-1111-1111-111111111102', 'Boteco da Praça', 'Petiscos rápidos e ambiente casual.', 'Gonzaga', 'Rua Sintética 102, Gonzaga', 2, array['rapido','grupo'], true, true),
('11111111-1111-1111-1111-111111111103', 'Massa & Brisa', 'Massas artesanais e vinho da casa.', 'Gonzaga', 'Rua Sintética 103, Gonzaga', 3, array['jantar_a_dois','familia'], true, true),
('11111111-1111-1111-1111-111111111104', 'Burger Atlântico', 'Burgers generosos para ir sem fome.', 'Gonzaga', 'Rua Sintética 104, Gonzaga', 2, array['rapido','grupo'], true, true),
('11111111-1111-1111-1111-111111111105', 'Sashimi Norte', 'Japonesa contemporânea.', 'Gonzaga', 'Rua Sintética 105, Gonzaga', 4, array['jantar_a_dois','especial'], true, true),
('11111111-1111-1111-1111-111111111106', 'Cantina da Vovó G', 'Pratos caseiros em porções generosas.', 'Gonzaga', 'Rua Sintética 106, Gonzaga', 1, array['familia','rapido'], true, true),
('11111111-1111-1111-1111-111111111107', 'Pizza do Trapiche', 'Forno a lenha e bordas recheadas.', 'Gonzaga', 'Rua Sintética 107, Gonzaga', 2, array['grupo','familia'], true, true),
('11111111-1111-1111-1111-111111111108', 'Verde Maré', 'Opções vegetarianas e bowls.', 'Gonzaga', 'Rua Sintética 108, Gonzaga', 2, array['rapido','jantar_a_dois'], true, true),
-- Boqueirão
('11111111-1111-1111-1111-111111111109', 'Orla Grill', 'Grelhados com vista fictícia da orla.', 'Boqueirão', 'Av. Sintética 201, Boqueirão', 3, array['jantar_a_dois','especial'], true, true),
('11111111-1111-1111-1111-111111111110', 'Taco da Duna', 'Mexicana rápida e colorida.', 'Boqueirão', 'Av. Sintética 202, Boqueirão', 1, array['rapido','grupo'], true, true),
('11111111-1111-1111-1111-111111111111', 'Casa Lotada Demo', 'Sempre cheio — cenário SEM VAGAS.', 'Boqueirão', 'Av. Sintética 203, Boqueirão', 2, array['grupo','rapido'], true, true),
('11111111-1111-1111-1111-111111111112', 'Peixaria do Cais', 'Peixe frito e porções para compartilhar.', 'Boqueirão', 'Av. Sintética 204, Boqueirão', 2, array['familia','grupo'], true, true),
('11111111-1111-1111-1111-111111111113', 'Bistrô Areia', 'Menu degustação curto.', 'Boqueirão', 'Av. Sintética 205, Boqueirão', 4, array['jantar_a_dois','especial'], true, true),
('11111111-1111-1111-1111-111111111114', 'Pastel & Cia BQ', 'Pastéis e caldo — rápido e barato.', 'Boqueirão', 'Av. Sintética 206, Boqueirão', 1, array['rapido'], true, true),
('11111111-1111-1111-1111-111111111115', 'Ramen da Enseada', 'Caldos longos e ovos moles.', 'Boqueirão', 'Av. Sintética 207, Boqueirão', 2, array['rapido','jantar_a_dois'], true, true),
('11111111-1111-1111-1111-111111111116', 'Churrasco do Farol', 'Espetos e mandioca frita.', 'Boqueirão', 'Av. Sintética 208, Boqueirão', 3, array['grupo','familia'], true, true),
-- Ponta da Praia
('11111111-1111-1111-1111-111111111117', 'Mirante do Estuário', 'Jantar especial com carteira alta.', 'Ponta da Praia', 'Rua Fictícia 301, Ponta da Praia', 4, array['jantar_a_dois','especial'], true, true),
('11111111-1111-1111-1111-111111111118', 'Barco Anchova', 'Petiscos de bar com chopp.', 'Ponta da Praia', 'Rua Fictícia 302, Ponta da Praia', 2, array['grupo','rapido'], true, true),
('11111111-1111-1111-1111-111111111119', 'Casa do Bacalhau PP', 'Portuguesa acolhedora.', 'Ponta da Praia', 'Rua Fictícia 303, Ponta da Praia', 3, array['familia','jantar_a_dois'], true, true),
('11111111-1111-1111-1111-111111111120', 'Açaí da Ponta', 'Bowls e wraps leves.', 'Ponta da Praia', 'Rua Fictícia 304, Ponta da Praia', 1, array['rapido'], true, true),
('11111111-1111-1111-1111-111111111121', 'Trattoria Ítalo PP', 'Risotos e massas.', 'Ponta da Praia', 'Rua Fictícia 305, Ponta da Praia', 3, array['jantar_a_dois','familia'], true, true),
('11111111-1111-1111-1111-111111111122', 'Hot Dog do Cais', 'Lanches noturnos.', 'Ponta da Praia', 'Rua Fictícia 306, Ponta da Praia', 1, array['rapido','grupo'], true, true),
('11111111-1111-1111-1111-111111111123', 'Thai da Maré', 'Curry e pads.', 'Ponta da Praia', 'Rua Fictícia 307, Ponta da Praia', 2, array['jantar_a_dois','rapido'], true, true),
('11111111-1111-1111-1111-111111111124', 'Steakhouse Estrela', 'Carnes nobres — preço alto.', 'Ponta da Praia', 'Rua Fictícia 308, Ponta da Praia', 4, array['especial','jantar_a_dois'], true, true),
-- Embaré
('11111111-1111-1111-1111-111111111125', 'Empório Embaré', 'Tábuas e vinhos.', 'Embaré', 'Rua Demo 401, Embaré', 3, array['jantar_a_dois','grupo'], true, true),
('11111111-1111-1111-1111-111111111126', 'Galeto da Esquina', 'Frango e farofa — família.', 'Embaré', 'Rua Demo 402, Embaré', 2, array['familia','grupo'], true, true),
('11111111-1111-1111-1111-111111111127', 'Crepe da Baía', 'Crepes doces e salgados.', 'Embaré', 'Rua Demo 403, Embaré', 1, array['rapido'], true, true),
('11111111-1111-1111-1111-111111111128', 'Sushi Embaré Lab', 'Combinados e temakis.', 'Embaré', 'Rua Demo 404, Embaré', 3, array['jantar_a_dois','grupo'], true, true),
('11111111-1111-1111-1111-111111111129', 'Falafel do Quarteirão', 'Árabe vegetariano.', 'Embaré', 'Rua Demo 405, Embaré', 1, array['rapido','familia'], true, true),
('11111111-1111-1111-1111-111111111130', 'Casa Nordeste E', 'Baião e carne de sol.', 'Embaré', 'Rua Demo 406, Embaré', 2, array['familia','grupo'], true, true),
('11111111-1111-1111-1111-111111111131', 'Fondue da Serra Fake', 'Experiência especial.', 'Embaré', 'Rua Demo 407, Embaré', 4, array['especial','jantar_a_dois'], true, true),
('11111111-1111-1111-1111-111111111132', 'Poke Wave', 'Pokes montados na hora.', 'Embaré', 'Rua Demo 408, Embaré', 2, array['rapido','jantar_a_dois'], true, true),
-- Aparecida
('11111111-1111-1111-1111-111111111133', 'Padoca & Prato', 'Almoço rápido de padaria.', 'Aparecida', 'Travessa Fake 501, Aparecida', 1, array['rapido','familia'], true, true),
('11111111-1111-1111-1111-111111111134', 'Cantina Aparecida', 'Italiana de bairro.', 'Aparecida', 'Travessa Fake 502, Aparecida', 2, array['familia','jantar_a_dois'], true, true),
('11111111-1111-1111-1111-111111111135', 'Parmegiana House', 'Clássicos empanados.', 'Aparecida', 'Travessa Fake 503, Aparecida', 2, array['familia','grupo'], true, true),
('11111111-1111-1111-1111-111111111136', 'Veg Aparecida', 'Cardápio 100% plant-based.', 'Aparecida', 'Travessa Fake 504, Aparecida', 2, array['rapido','jantar_a_dois'], true, true),
('11111111-1111-1111-1111-111111111137', 'Churrasquinho do Zé Fake', 'Espetinhos na calçada.', 'Aparecida', 'Travessa Fake 505, Aparecida', 1, array['rapido','grupo'], true, true),
('11111111-1111-1111-1111-111111111138', 'Osteria da Colina', 'Jantar a dois sofisticado.', 'Aparecida', 'Travessa Fake 506, Aparecida', 4, array['jantar_a_dois','especial'], true, true),
('11111111-1111-1111-1111-111111111139', 'Lámen do Beco', 'Lámens generosos.', 'Aparecida', 'Travessa Fake 507, Aparecida', 2, array['rapido','grupo'], true, true),
('11111111-1111-1111-1111-111111111140', 'Doces & Ceia', 'Café noturno e sobremesas.', 'Aparecida', 'Travessa Fake 508, Aparecida', 2, array['jantar_a_dois','rapido'], true, true);

-- Horários: seg–dom 11:00–23:00 para todos
insert into public.restaurant_hours (restaurant_id, weekday, open_time, close_time)
select r.id, d.weekday, time '11:00', time '23:00'
from public.restaurants r
cross join generate_series(0, 6) as d(weekday);

-- Slots: próximos 7 dias, 19:00 e 20:30
-- Capacidade padrão 20; Casa Lotada Demo (111) reserved_count = capacity (SEM VAGAS)
insert into public.restaurant_slots (restaurant_id, starts_at, capacity, reserved_count)
select
  r.id,
  (date_trunc('day', now() at time zone 'America/Sao_Paulo') + (d.day || ' days')::interval + t.hour_offset)::timestamptz,
  case when r.id = '11111111-1111-1111-1111-111111111111' then 10 else 20 end,
  case when r.id = '11111111-1111-1111-1111-111111111111' then 10 else 0 end
from public.restaurants r
cross join generate_series(0, 6) as d(day)
cross join (values (interval '19 hours'), (interval '20 hours 30 minutes')) as t(hour_offset);
