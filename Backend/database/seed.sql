-- =====================================================
-- MOVOUT - Script de Dados de Exemplo (Seed)
-- Use este script para popular o banco com dados de teste
-- =====================================================

USE movout_db;

-- =====================================================
-- INSERÇÃO DE PESSOAS
-- =====================================================

-- Senha: 123456 (hash bcrypt válido)
-- Hash: $2b$12$QFv1xQfksgieQam0foC.d.OjzOIMRzIwf8lBseOC//B7zYkTpmK1a
INSERT INTO pessoa7 (nome, cpf, email, telefone, senha_hash, sexo, idade) VALUES
('Fabricio Costa', '123.456.789-00', 'fabricio@ufmt.br', '(65) 99999-9999', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5GyY5GyY5G', 'M', 25),
('Maria Silva', '987.654.321-00', 'maria@email.com', '(65) 98888-8888', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5GyY5GyY5G', 'F', 30),
('João Santos', '111.222.333-44', 'joao@email.com', '(65) 97777-7777', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5GyY5GyY5G', 'M', 35),
('Ana Oliveira', '555.666.777-88', 'ana@email.com', '(65) 96666-6666', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5GyY5GyY5G', 'F', 28);

-- =====================================================
-- INSERÇÃO DE CLIENTES
-- =====================================================

INSERT INTO cliente7 (id_pessoa, tipo_cliente, observacoes) VALUES
(1, 'PESSOA_FISICA', 'Cliente VIP'),
(2, 'PESSOA_FISICA', 'Cliente regular');

-- =====================================================
-- INSERÇÃO DE MOTORISTAS
-- =====================================================

INSERT INTO motorista7 (id_pessoa, avaliacao_media, data_inicio, cnh, status) VALUES
(3, 4.5, '2023-01-15', '12345678901', 'ATIVO'),
(4, 4.8, '2023-03-20', '98765432109', 'ATIVO');

-- =====================================================
-- INSERÇÃO DE VEÍCULOS
-- =====================================================

INSERT INTO veiculo7 (id_motorista, tipo, carga_max_kg, volume_max_carga, marca, modelo, placa, ano, cor, status) VALUES
(1, 'Caminhão', 5000.00, 30.00, 'Volvo', 'FH 460', 'ABC-1234', 2020, 'Branco', 'DISPONIVEL'),
(1, 'Van', 1500.00, 12.00, 'Mercedes-Benz', 'Sprinter', 'DEF-5678', 2021, 'Prata', 'DISPONIVEL'),
(2, 'Carreta', 10000.00, 60.00, 'Scania', 'R 500', 'GHI-9012', 2019, 'Azul', 'DISPONIVEL');

-- =====================================================
-- INSERÇÃO DE ITENS MODELO (Catálogo)
-- =====================================================

INSERT INTO item_modelo7 (id_yolo_classe, nome, categoria, peso_kg, largura_m, altura_m, profundidade_m, preco_base, ativo) VALUES
(0, 'Geladeira', 'Eletrodomésticos', 80.00, 0.70, 1.80, 0.70, 50.00, TRUE),
(1, 'Fogão', 'Eletrodomésticos', 45.00, 0.60, 0.90, 0.60, 30.00, TRUE),
(2, 'Sofá', 'Móveis', 60.00, 2.00, 0.90, 0.90, 40.00, TRUE),
(3, 'Mesa', 'Móveis', 25.00, 1.20, 0.75, 0.80, 25.00, TRUE),
(4, 'Cama', 'Móveis', 50.00, 1.90, 0.20, 1.40, 35.00, TRUE),
(5, 'Caixa de Mudança', 'Embalagens', 20.00, 0.60, 0.40, 0.50, 10.00, TRUE);

-- =====================================================
-- INSERÇÃO DE FRETES
-- =====================================================

INSERT INTO frete7 (
    id_cliente, 
    id_motorista, 
    id_veiculo,
    endereco_origem, 
    endereco_destino,
    coordenada_origem_lat,
    coordenada_origem_lng,
    coordenada_destino_lat,
    coordenada_destino_lng,
    distancia_km, 
    peso_total_kg, 
    volume_carga_total, 
    preco_estimado, 
    preco_fechado,
    status
) VALUES
(
    1, 
    NULL, 
    NULL,
    'Rua das Flores, 123, Cuiabá-MT',
    'Av. Central, 456, Várzea Grande-MT',
    -15.6014,
    -56.0979,
    -15.6458,
    -56.1322,
    25.5, 
    200.00, 
    8.50, 
    350.00, 
    NULL,
    'PENDENTE'
),
(
    1,
    1,
    1,
    'Rua A, 100, Cuiabá-MT',
    'Rua B, 200, Rondonópolis-MT',
    -15.6014,
    -56.0979,
    -16.4677,
    -54.6361,
    215.0,
    500.00,
    15.00,
    800.00,
    750.00,
    'EM_TRANSITO'
),
(
    2,
    NULL,
    NULL,
    'Av. Principal, 50, Várzea Grande-MT',
    'Rua Secundária, 75, Cuiabá-MT',
    -15.6458,
    -56.1322,
    -15.6014,
    -56.0979,
    18.0,
    150.00,
    6.00,
    250.00,
    NULL,
    'NEGOCIANDO'
);

-- =====================================================
-- INSERÇÃO DE FRETE_ITEM (Itens dos Fretes)
-- =====================================================

INSERT INTO frete_item7 (id_frete, id_item, quantidade, peso_estimado_kg, volume_estimado_m3) VALUES
(1, 1, 1, 80.00, 0.882),  -- 1 Geladeira
(1, 2, 1, 45.00, 0.324),  -- 1 Fogão
(1, 3, 1, 60.00, 1.620), -- 1 Sofá
(1, 5, 2, 40.00, 0.532), -- 2 Caixas
(2, 1, 2, 160.00, 1.764), -- 2 Geladeiras
(2, 3, 1, 60.00, 1.620),  -- 1 Sofá
(2, 4, 1, 25.00, 0.720),  -- 1 Mesa
(3, 2, 1, 45.00, 0.324),  -- 1 Fogão
(3, 5, 3, 60.00, 0.360);  -- 3 Caixas

-- =====================================================
-- INSERÇÃO DE NEGOCIAÇÕES
-- =====================================================

INSERT INTO negociacao7 (
    id_frete, 
    id_motorista, 
    id_veiculo, 
    preco_proposto, 
    distancia_km, 
    volume_carga, 
    peso_carga, 
    status,
    observacoes
) VALUES
(
    3,
    1,
    2,
    280.00,
    18.0,
    6.00,
    150.00,
    'PENDENTE',
    'Disponível para retirada imediata'
),
(
    1,
    2,
    3,
    320.00,
    25.5,
    8.50,
    200.00,
    'PENDENTE',
    'Preço especial para cliente'
);

-- =====================================================
-- INSERÇÃO DE TOKENS DE NOTIFICAÇÃO
-- =====================================================

INSERT INTO token_notificaca (id_pessoa, token, plataforma, ativo) VALUES
(1, 'token_fcm_cliente_123456', 'ANDROID', 1),
(2, 'token_fcm_cliente_789012', 'IOS', 1),
(3, 'token_fcm_motorista_345678', 'ANDROID', 1),
(4, 'token_fcm_motorista_901234', 'ANDROID', 1);

-- =====================================================
-- FIM DO SCRIPT DE SEED
-- =====================================================
