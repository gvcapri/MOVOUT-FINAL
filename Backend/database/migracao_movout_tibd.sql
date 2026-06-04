USE movout7;

CREATE TABLE IF NOT EXISTS cartao_cliente7 (
    id_cartao BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_cliente BIGINT UNSIGNED NOT NULL,
    apelido VARCHAR(80) NULL,
    titular VARCHAR(120) NULL,
    bandeira VARCHAR(30) NULL,
    ultimos4 CHAR(4) NOT NULL,
    mes_expiracao TINYINT NULL,
    ano_expiracao SMALLINT NULL,
    token_pagamento VARCHAR(255) NULL,
    principal TINYINT DEFAULT 0,
    ativo TINYINT DEFAULT 1,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_cartao),
    INDEX idx_cartao_cliente7_cliente (id_cliente),
    INDEX idx_cartao_cliente7_principal (id_cliente, principal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS avaliacao_frete7 (
    id_avaliacao BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_frete BIGINT UNSIGNED NOT NULL,
    tipo_avaliador VARCHAR(20) NOT NULL,
    id_avaliador_pessoa BIGINT UNSIGNED NOT NULL,
    id_avaliado_pessoa BIGINT UNSIGNED NOT NULL,
    nota TINYINT NOT NULL,
    comentario TEXT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_avaliacao),
    UNIQUE KEY uk_avaliacao_frete_tipo (id_frete, tipo_avaliador),
    INDEX idx_avaliacao_frete7_frete (id_frete),
    INDEX idx_avaliacao_frete7_avaliado (id_avaliado_pessoa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tarifa_veiculo7 (
    tipo_veiculo VARCHAR(20) NOT NULL,
    descricao VARCHAR(80) NOT NULL,
    valor_base DECIMAL(10,2) NOT NULL DEFAULT 0,
    valor_por_km DECIMAL(10,2) NOT NULL DEFAULT 0,
    valor_por_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    multiplicador DECIMAL(10,2) NOT NULL DEFAULT 1,
    ativo TINYINT DEFAULT 1,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (tipo_veiculo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tarifa_prioridade7 (
    prioridade VARCHAR(20) NOT NULL,
    descricao VARCHAR(80) NOT NULL,
    multiplicador DECIMAL(10,2) NOT NULL DEFAULT 1,
    taxa_fixa DECIMAL(10,2) NOT NULL DEFAULT 0,
    ativo TINYINT DEFAULT 1,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (prioridade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tarifa_veiculo7 (tipo_veiculo, descricao, valor_base, valor_por_km, valor_por_kg, multiplicador, ativo)
VALUES
('CARRO', 'Carro', 12.00, 2.20, 0.10, 1.00, 1),
('VAN', 'Van', 20.00, 3.20, 0.16, 1.35, 1),
('CAMINHAO', 'Caminhão', 35.00, 5.00, 0.24, 1.85, 1)
ON DUPLICATE KEY UPDATE descricao=VALUES(descricao), valor_base=VALUES(valor_base), valor_por_km=VALUES(valor_por_km), valor_por_kg=VALUES(valor_por_kg), multiplicador=VALUES(multiplicador), ativo=VALUES(ativo);

INSERT INTO tarifa_prioridade7 (prioridade, descricao, multiplicador, taxa_fixa, ativo)
VALUES
('20_MINUTOS', 'Em até 20 minutos', 1.35, 10.00, 1),
('HOJE', 'Ainda hoje', 1.15, 5.00, 1),
('AGENDADO', 'Agendado', 1.00, 0.00, 1)
ON DUPLICATE KEY UPDATE descricao=VALUES(descricao), multiplicador=VALUES(multiplicador), taxa_fixa=VALUES(taxa_fixa), ativo=VALUES(ativo);

ALTER TABLE motorista7 ADD COLUMN IF NOT EXISTS numero_cnh VARCHAR(20) NULL;
ALTER TABLE motorista7 ADD COLUMN IF NOT EXISTS categoria_cnh VARCHAR(5) NULL;
ALTER TABLE motorista7 ADD COLUMN IF NOT EXISTS validade_cnh DATE NULL;
ALTER TABLE motorista7 ADD COLUMN IF NOT EXISTS uf_cnh VARCHAR(2) NULL;
ALTER TABLE motorista7 ADD COLUMN IF NOT EXISTS cnh_verificada TINYINT DEFAULT 0;
ALTER TABLE motorista7 ADD COLUMN IF NOT EXISTS situacao_cnh VARCHAR(30) DEFAULT 'PENDENTE';

ALTER TABLE carteira_motorista7 ADD COLUMN IF NOT EXISTS numero_cnh VARCHAR(20) NULL;
ALTER TABLE carteira_motorista7 ADD COLUMN IF NOT EXISTS categoria_cnh VARCHAR(5) NULL;
ALTER TABLE carteira_motorista7 ADD COLUMN IF NOT EXISTS validade_cnh DATE NULL;
ALTER TABLE carteira_motorista7 ADD COLUMN IF NOT EXISTS uf_cnh VARCHAR(2) NULL;
ALTER TABLE carteira_motorista7 ADD COLUMN IF NOT EXISTS cnh_verificada TINYINT DEFAULT 0;
ALTER TABLE carteira_motorista7 ADD COLUMN IF NOT EXISTS situacao_cnh VARCHAR(30) DEFAULT 'PENDENTE';

ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS id_cartao_cliente BIGINT UNSIGNED NULL;
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS metodo_pagamento VARCHAR(40) NULL;
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS pagamento_descricao VARCHAR(120) NULL;
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS prioridade_entrega VARCHAR(20) DEFAULT 'HOJE';
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS data_agendada DATETIME NULL;
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS tipo_veiculo_solicitado VARCHAR(20) DEFAULT 'CARRO';
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS peso_estimado_kg DECIMAL(10,2) DEFAULT 0;
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS distancia_km DECIMAL(10,2) DEFAULT 0;
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS valor_base DECIMAL(10,2) DEFAULT 0;
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS valor_distancia DECIMAL(10,2) DEFAULT 0;
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS valor_peso DECIMAL(10,2) DEFAULT 0;
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS valor_veiculo DECIMAL(10,2) DEFAULT 0;
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS valor_prioridade DECIMAL(10,2) DEFAULT 0;
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS valor_total_calculado DECIMAL(10,2) DEFAULT 0;
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS cliente_confirmou_conclusao TINYINT DEFAULT 0;
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS motorista_confirmou_conclusao TINYINT DEFAULT 0;
ALTER TABLE frete7 ADD COLUMN IF NOT EXISTS concluido_em DATETIME NULL;

ALTER TABLE pedidofrete ADD COLUMN IF NOT EXISTS id_cartao_cliente BIGINT UNSIGNED NULL;
ALTER TABLE pedidofrete ADD COLUMN IF NOT EXISTS metodo_pagamento VARCHAR(40) NULL;
ALTER TABLE pedidofrete ADD COLUMN IF NOT EXISTS pagamento_descricao VARCHAR(120) NULL;
ALTER TABLE pedidofrete ADD COLUMN IF NOT EXISTS prioridade_entrega VARCHAR(20) DEFAULT 'HOJE';
ALTER TABLE pedidofrete ADD COLUMN IF NOT EXISTS data_agendada DATETIME NULL;
ALTER TABLE pedidofrete ADD COLUMN IF NOT EXISTS tipo_veiculo_solicitado VARCHAR(20) DEFAULT 'CARRO';
ALTER TABLE pedidofrete ADD COLUMN IF NOT EXISTS peso_estimado_kg DECIMAL(10,2) DEFAULT 0;
ALTER TABLE pedidofrete ADD COLUMN IF NOT EXISTS distancia_km DECIMAL(10,2) DEFAULT 0;
ALTER TABLE pedidofrete ADD COLUMN IF NOT EXISTS valor_total_calculado DECIMAL(10,2) DEFAULT 0;

DROP VIEW IF EXISTS vw_cliente_perfil7;
CREATE VIEW vw_cliente_perfil7 AS
SELECT
    c.id_cliente,
    p.id_pessoa,
    p.nome,
    p.email,
    COUNT(CASE WHEN LOWER(f.status) IN ('concluido', 'concluído', 'finalizado') THEN 1 END) AS fretes_concluidos,
    COALESCE(ROUND(AVG(CASE WHEN a.tipo_avaliador = 'MOTORISTA' THEN a.nota END), 2), 0) AS avaliacao_media_cliente
FROM cliente7 c
JOIN pessoa7 p ON p.id_pessoa = c.id_pessoa
LEFT JOIN frete7 f ON f.id_cliente = c.id_cliente
LEFT JOIN avaliacao_frete7 a ON a.id_frete = f.id_frete AND a.id_avaliado_pessoa = p.id_pessoa AND a.tipo_avaliador = 'MOTORISTA'
GROUP BY c.id_cliente, p.id_pessoa, p.nome, p.email;
